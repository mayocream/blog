---
title: "cfssl 核心模块分析"
date: "2021-11-06T13:30:00+08:00"
typeface: sans
toc: true
---

## 1. 概述

### 1.1. 项目简介

*cfssl* 是 Cloudflare 的 PKI，也是证书生成的工具链。*cfssl* 作为证书生成的工具链可能更为人熟知，Google 上搜索到的关于 *cfssl* 的介绍以及使用都是关于使用 CLI 生成自签名证书的，几乎没有针对 *cfssl* 作为 CA 中心的介绍。

从 commit 历史来看这是一个 7 年前就启动的项目，项目中的文档大部分还是 *.txt* 后缀的纯文本。但是项目的完成度很高，内部 CA 实现了多层级，能够引入外部 CA，包括提供了调用 CA API 的 Go 的 Client 包，以及用于证书轮换的 KeyProvider package。

以及有 Cloudflare 官方的 certmgr 项目，用于在 K8s 集群中使用 cfssl 自动签发证书，该项目描述中提到在 CF 的生成环境使用。说到此处本人想到 CF 在其域名托管的服务中有免费 TLS 证书生成，包含 Origin、Browser 证书，或许是使用该项目进行生成的。

但是项目更新速度比较慢，本人提的 2 个 Pull Request 等了一周只被合并了一个，另一个 feature 类型的 PR 还在等待审核。

*Istio* 最开始也是使用 *cfssl* 生成自签名 CA 证书，但是由于 *Istio* 内部需要实现 SDS 协议、兼容 SPIFFE ID 标准，在后续的迭代中使用了自己的 PKI 将其替换了。

*cfssl* 官方 master 分支的代码不能完全满足我们的需求，例如不兼容 SAN URI 字段的证书签发，证书轮换客户端使用过于繁琐……但是基于 *cfssl* 我们能够快速实现一个业界标准的，完备的 PKI、CA 中心。

### 1.2. 项目结构

*cfssl* 由一组组工具包组成，功能较为独立，因此也能够方便的从其他项目引用这些包。

```bash
$ tree -d -L 1 -A
.
├── api
├── auth
├── bundler
├── certdb
├── certinfo
├── cli
├── cmd
├── config
├── crl
├── crypto
├── csr
├── doc
├── errors
├── helpers
├── info
├── initca
├── log
├── multiroot
├── ocsp
├── revoke
├── scan
├── selfsign
├── signer
├── testdata
├── transport
├── ubiquity
├── vendor
└── whitelist

28 directories
```

## 2. 源码分析

由于市面上的 Golang PKI 程序目录结构都是一个个包组成的，例如 [letsencrypt/boulder](https://github.com/letsencrypt/boulder) 项目，这里通过流程分析更清晰。

### 2.0. 架构设计

#### 2.0.1. Profiles

*cfssl* 的配置以 *profile* 区分，这里看一个**CA 中心**示例配置：

```json
{
  "signing": {
    "default": {
      "expiry": "168h"
    },
    "profiles": {
      "client": {
        "expiry": "1h",
        "usages": [
          "signing",
          "key encipherment",
          "client auth"
        ]
      },
      "server": {
        "expiry": "1h",
        "usages": [
          "signing",
          "key encipherment",
          "server auth"
        ]
      }
    }
  }
}
```

根据 profile name 区分不同的签名类型。

我们再来看通过 SDK 连接 CA 中心的配置文件：

```json
{
  "request": {
    "CN": "test server",
    "hosts": [
      "127.0.0.1"
    ]
  },
  "profiles": {
    "paths": {
      "private_key": "server.key",
      "certificate": "server.pem"
    },
    "cfssl": {
      "profile": "server",
      "remote": "127.0.0.1:8888"
    }
  },
  "roots": [
    {
      "type": "system"
    }
  ],
  "client_roots": [
    {
      "type": "cfssl",
      "metadata": {
        "host": "127.0.0.1:8888",
        "profile": "client"
      }
    }
  ]
}

```

CA 中心会根据 profile 不同，使用不同的配置去处理请求、签发证书。

#### 2.0.2. 认证体系

*cfssl* 支持使用 mTLS，以及 Auth Key 来进行身份验证。

其中 Auth Key 支持 `standard` 和 `standard-ip` 两种类型。

CA 中心配置示例：

```json
{
  "auth_keys": {
    "client": {
      "type": "standard",
      "key": "52abb3ac91971bb72bce17e7a289cd04476490b19e0d8eb7810dc42d4ac16c41"
    },
    "server": {
      "type": "standard",
      "key": "4f4f26686209f672e0ec7b19cbbc8b6d94fdd12cc0b20326f9005d5f234e6e3e"
    }
  },
  "signing": {
    "default": {
      "expiry": "168h"
    },
    "profiles": {
      "client": {
        "auth_key": "client",
        "expiry": "1h",
        "usages": [
          "signing",
          "key encipherment",
          "client auth"
        ]
      },
      "server": {
        "auth_key": "server",
        "expiry": "8760h",
        "usages": [
          "signing",
          "key encipherment",
          "server auth"
        ]
      }
    }
  }
}

```

SDK 客户端配置示例：

```json
{
  "request": {
    "CN": "test server",
    "hosts": ["127.0.0.1"]
  },
  "profiles": {
    "paths": {
      "private_key": "server.key",
      "certificate": "server.pem"
    },
    "cfssl": {
      "profile": "server",
      "remote": "127.0.0.1:8888",
      "auth-type": "standard",
      "auth-key": "4f4f26686209f672e0ec7b19cbbc8b6d94fdd12cc0b20326f9005d5f234e6e3e"
    }
  },
  "roots": [{
    "type": "system"
  }],
  "client_roots": [{
    "type": "cfssl",
    "metadata": {
      "host": "127.0.0.1:8888",
      "profile": "client"
    }
  }]
}
```

### 2.1. 证书管理

我们从一组官方给出的示例 shell 当作入口来看：

```bash
#!/bin/sh

cfssl gencert -initca ca.json | cfssljson -bare ca
```

`ca.json` 文件内容：

```json
{
  "hosts": [
    "dropsonde.net"
  ],
  "key": {
    "algo": "rsa",
    "size": 4096
  },
  "names": [
    {
      "C": "US",
      "L": "San Francisco",
      "OU": "Dropsonde Certificate Authority",
      "ST": "California"
    }
  ]
}
```

`cfssl gencert` 命令注释：

```go
var gencertUsageText = `cfssl gencert -- generate a new key and signed certificate

Usage of gencert:
    Generate a new key and cert from CSR:
        cfssl gencert -initca CSRJSON
        cfssl gencert -ca cert -ca-key key [-config config] [-profile profile] [-hostname hostname] CSRJSON
        cfssl gencert -remote remote_host [-config config] [-profile profile] [-label label] [-hostname hostname] CSRJSON

    Re-generate a CA cert with the CA key and CSR:
        cfssl gencert -initca -ca-key key CSRJSON

    Re-generate a CA cert with the CA key and certificate:
        cfssl gencert -renewca -ca cert -ca-key key

Arguments:
        CSRJSON:    JSON file containing the request, use '-' for reading JSON from stdin

Flags:
`
```

#### 2.1.1. 生成私钥

`-initca` 参数表示是 CA。

```go
// cli/gencert/gencert.go

// 创建默认 CSR 请求
req := csr.CertificateRequest{
   // 默认使用 ecdsa, 256 生成 private key
   KeyRequest: csr.NewKeyRequest(),
}
```

*cfssl* 中默认使用 ECDSA with *curve P-256* 算法生成私钥。

以下摘自 [rfc6605](https://tools.ietf.org/html/rfc6605) (Elliptic Curve Digital Signature Algorithm (DSA) for DNSSEC)

 > Current estimates are that ECDSA with curve P-256 has an approximate
   equivalent strength to RSA with 3072-bit keys.  Using ECDSA with
   curve P-256 in DNSSEC has some advantages and disadvantages relative
   to using RSA with SHA-256 and with 3072-bit keys.  ECDSA keys are
   much shorter than RSA keys; at this size, the difference is 256
   versus 3072 bits.  Similarly, ECDSA signatures are much shorter than
   RSA signatures.  This is relevant because DNSSEC stores and transmits
   both keys and signatures.
   
   In the two signing algorithms defined in this document, the size of
   the key for the elliptic curve is matched with the size of the output
   of the hash algorithm.  This design is based on the widespread belief
   that the equivalent strength of P-256 and P-384 is half the length of
   the key, and also that the equivalent strength of SHA-256 and SHA-384
   is half the length of the key.  Using matched strengths prevents an
   attacker from choosing the weaker half of a signature algorithm.  For
   example, in a signature that uses RSA with 2048-bit keys and SHA-256,
   the signing portion is significantly weaker than the hash portion,
   whereas the two algorithms here are balanced.
   
   Signing with ECDSA is significantly faster than with RSA (over 20
   times in some implementations).  However, validating RSA signatures
   is significantly faster than validating ECDSA signatures (about 5
   times faster in some implementations).

ECDSA with curve P-256 与 RSA with SHA-256 强度相当；前者签名速度快于后者，后者验证速度快于前者。

```go
// csr/csr.go

// Generate generates a key as specified in the request. Currently,
// only ECDSA and RSA are supported.
func (kr *KeyRequest) Generate() (crypto.PrivateKey, error) {
	log.Debugf("generate key from request: algo=%s, size=%d", kr.Algo(), kr.Size())
	switch kr.Algo() {
	case "rsa":
		if kr.Size() < 2048 {
			return nil, errors.New("RSA key is too weak")
		}
		if kr.Size() > 8192 {
			return nil, errors.New("RSA key size too large")
		}
		return rsa.GenerateKey(rand.Reader, kr.Size())
	case "ecdsa":
		var curve elliptic.Curve
		switch kr.Size() {
		case curveP256:
			curve = elliptic.P256()
		case curveP384:
			curve = elliptic.P384()
		case curveP521:
			curve = elliptic.P521()
		default:
			return nil, errors.New("invalid curve")
		}
		// 调用官方包生成私钥
		return ecdsa.GenerateKey(curve, rand.Reader)
	default:
		return nil, errors.New("invalid algorithm")
	}
}
```

私钥转换为 PEM 格式：

```go
// csr/csr.go

	// 私钥转换成 pem 格式
	switch priv := priv.(type) {
	case *rsa.PrivateKey:
		key = x509.MarshalPKCS1PrivateKey(priv)
		block := pem.Block{
			Type:  "RSA PRIVATE KEY",
			Bytes: key,
		}
		key = pem.EncodeToMemory(&block)
	case *ecdsa.PrivateKey:
		key, err = x509.MarshalECPrivateKey(priv)
		if err != nil {
			err = cferr.Wrap(cferr.PrivateKeyError, cferr.Unknown, err)
			return
		}
		block := pem.Block{
			Type:  "EC PRIVATE KEY",
			Bytes: key,
		}
		key = pem.EncodeToMemory(&block)
```

#### 2.1.2. 生成 CSR

`csr, err = Generate(priv.(crypto.Signer), req)`

```go
// 根据私钥和请求参数生成标准 CSR
// Generate creates a new CSR from a CertificateRequest structure and
// an existing key. The KeyRequest field is ignored.
func Generate(priv crypto.Signer, req *CertificateRequest) (csr []byte, err error) {
	// 获取 x509 签名算法
	sigAlgo := helpers.SignerAlgo(priv)
	if sigAlgo == x509.UnknownSignatureAlgorithm {
		return nil, cferr.New(cferr.PrivateKeyError, cferr.Unavailable)
	}

	// csr 模板
	var tpl = x509.CertificateRequest{
		Subject:            req.Name(), // 填充 subject 字段
		SignatureAlgorithm: sigAlgo,
	}

	// 解析填充 SAN 字段
	for i := range req.Hosts {
		if ip := net.ParseIP(req.Hosts[i]); ip != nil {
			tpl.IPAddresses = append(tpl.IPAddresses, ip)
		} else if email, err := mail.ParseAddress(req.Hosts[i]); err == nil && email != nil {
			tpl.EmailAddresses = append(tpl.EmailAddresses, email.Address)
		} else if uri, err := url.ParseRequestURI(req.Hosts[i]); err == nil && uri != nil {
			tpl.URIs = append(tpl.URIs, uri)
		} else {
			tpl.DNSNames = append(tpl.DNSNames, req.Hosts[i])
		}
	}

	tpl.ExtraExtensions = []pkix.Extension{}

    ...

	// 调用 x509 包生成 csr
	csr, err = x509.CreateCertificateRequest(rand.Reader, &tpl, priv)
	if err != nil {
		log.Errorf("failed to generate a CSR: %v", err)
		err = cferr.Wrap(cferr.CSRError, cferr.BadRequest, err)
		return
	}
	block := pem.Block{
		Type:  "CERTIFICATE REQUEST",
		Bytes: csr,
	}

	log.Info("encoded CSR")
	// 生成 pem 格式 csr
	csr = pem.EncodeToMemory(&block)
	return
}
```

`csr.Generate()` 接收的 Request 参数实际上是作为 CSR 的模板。

此处与 Istio PKI 中生成 CSR 的函数相似，感兴趣的也可以查看本人的《Istio 安全模块解析》文档。

实际开发过程中发现此处有坑，*cfssl* 此处虽然支持了 SAN URI 的字段，但是在通过 cfssl CA Provider 发送 CSR　请求证书的时候，其服务端不支持 SAN URI 字段到证书的填充。针对这一点我已经提交了 Pull Requst。

我们在实际开发中，使用创建 CSR 请求的包是来自 Istio PKI 的，其提供了更便捷的使用方式。

#### 2.1.3. Signer

##### 2.1.3.1. 本地自签名

```go
// initca/initca.go

// 创建本地自签名 signer
s, err := local.NewSigner(priv, nil, signer.DefaultSigAlgo(priv), policy)
if err != nil {
	log.Errorf("failed to create signer: %v", err)
	return
}

signReq := signer.SignRequest{Hosts: req.Hosts, Request: string(csrPEM)}
cert, err = s.Sign(signReq)
```
##### 2.1.3.2. Universal

设置 Remote CA，或通过 Server 启动时，会创建 Universal Signer。

```go
// SignerFromConfigAndDB takes the Config and creates the appropriate
// signer.Signer object with a specified db
func SignerFromConfigAndDB(c cli.Config, db *sqlx.DB) (signer.Signer, error) {
   // If there is a config, use its signing policy. Otherwise create a default policy.
   var policy *config.Signing
   if c.CFG != nil {
      policy = c.CFG.Signing
   } else {
      policy = &config.Signing{
         Profiles: map[string]*config.SigningProfile{},
         Default:  config.DefaultConfig(),
      }
   }

   // Make sure the policy reflects the new remote
   if c.Remote != "" {
      err := policy.OverrideRemotes(c.Remote)
      if err != nil {
         log.Infof("Invalid remote %v, reverting to configuration default", c.Remote)
         return nil, err
      }
   }

   if c.MutualTLSCertFile != "" && c.MutualTLSKeyFile != "" {
      err := policy.SetClientCertKeyPairFromFile(c.MutualTLSCertFile, c.MutualTLSKeyFile)
      if err != nil {
         log.Infof("Invalid mutual-tls-cert: %s or mutual-tls-key: %s, defaulting to no client auth", c.MutualTLSCertFile, c.MutualTLSKeyFile)
         return nil, err
      }
      log.Infof("Using client auth with mutual-tls-cert: %s and mutual-tls-key: %s", c.MutualTLSCertFile, c.MutualTLSKeyFile)
   }

   if c.TLSRemoteCAs != "" {
      err := policy.SetRemoteCAsFromFile(c.TLSRemoteCAs)
      if err != nil {
         log.Infof("Invalid tls-remote-ca: %s, defaulting to system trust store", c.TLSRemoteCAs)
         return nil, err
      }
      log.Infof("Using trusted CA from tls-remote-ca: %s", c.TLSRemoteCAs)
   }

   s, err := universal.NewSigner(cli.RootFromConfig(&c), policy)
   if err != nil {
      return nil, err
   }

   if db != nil {
      dbAccessor := certsql.NewAccessor(db)
      s.SetDBAccessor(dbAccessor)
   }

   return s, nil
}
```

这里可以看到能够设置 TLS 客户端证书、信任的 CA 证书，以及 DB。

这些配置项都是从文件读取的，后续开发过程中我考虑会改成配置项获取流程：

1. 从 ENV 获取配置项
2. 从数据库获取自身 CA 证书、没有则创建 CA 证书
3. 将证书写入临时文件，将临时文件地址传入 cfssl 配置项

尽量减少修改源代码的工程量，保持最大的社区兼容性。

##### 2.1.3.3. Remote

*cfssl* 配置远程证书签发，

```go
// Helper function to perform a remote sign or info request.
func (s *Signer) remoteOp(req interface{}, profile, target string) (resp interface{}, err error) {
   jsonData, err := json.Marshal(req)
   if err != nil {
      return nil, cferr.Wrap(cferr.APIClientError, cferr.JSONError, err)
   }

   p, err := signer.Profile(s, profile)
   if err != nil {
      return
   }

   server := client.NewServerTLS(p.RemoteServer, helpers.CreateTLSConfig(p.RemoteCAs, p.ClientCert))
   if server == nil {
      return nil, cferr.Wrap(cferr.PolicyError, cferr.InvalidRequest,
         errors.New("failed to connect to remote"))
   }

   server.SetReqModifier(s.reqModifier)

   // There's no auth provider for the "info" method
   if target == "info" {
      resp, err = server.Info(jsonData)
   } else if p.RemoteProvider != nil {
      resp, err = server.AuthSign(jsonData, nil, p.RemoteProvider)
   } else {
      resp, err = server.Sign(jsonData)
   }

   if err != nil {
      return nil, err
   }

   return
}
```

涉及到使用 Remote CA 的操作会使用 *cfssl/api* 包，调用远程 CA 接口处理。

#### 2.1.4. 证书处理

##### 2.1.4.1. Pre-Issuance Linting

```go
// signer/local/local.go

	var lintPriv crypto.Signer
	// If there is at least one profile (including the default) that configures
	// pre-issuance linting then generate the one-off lintPriv key.
	for _, profile := range policy.Profiles {
		if profile.LintErrLevel > 0 || policy.Default.LintErrLevel > 0 {
			// In the future there may be demand for specifying the type of signer used
			// for pre-issuance linting in configuration. For now we assume that signing
			// with a randomly generated P-256 ECDSA private key is acceptable for all cases
			// where linting is requested.
			k, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
			if err != nil {
				return nil, cferr.New(cferr.PrivateKeyError, cferr.GenerationFailed)
			}
			lintPriv = k
			break
		}
	}
```

pre-issuance linting 即预签发校验，[Mozilla CA](https://wiki.mozilla.org/CA/Required_or_Recommended_Practices#Pre-Issuance_Linting) 对此的解释是：

> Recently, several tools have been developed ([certlint/cablint](https://github.com/awslabs/certlint), [x509lint](https://github.com/kroeckx/x509lint), [zlint](https://github.com/zmap/zlint)) which can check a tbsCertificate (To Be Signed Certificate - the  certificate complete except for the signature) for a large number of  standards violations (BRs, RFCs etc.). It is strongly recommended that  CAs integrate such tools into their issuance pipelines such that  issuance is, minimally, held up for manual review if an error or warning is found. Because BR or RFC violations are generally considered by  Mozilla to be misissuance, such integration will reduce the number of  misissuance events a CA experiences, if earlier parts of their pipeline  fail in their job of keeping certificates compliant.

*cfssl* 在 [Issue #1008](https://github.com/cloudflare/cfssl/issues/1008) 中增加对证书 lint 的支持。

```go
// signer/local/local.go

// lint performs pre-issuance linting of a given TBS certificate template when
// the provided errLevel is > 0. Note that the template is provided by-value and
// not by-reference. This is important as the lint function needs to mutate the
// template's signature algorithm to match the lintPriv.
func (s *Signer) lint(template x509.Certificate, errLevel lint.LintStatus, lintRegistry lint.Registry) error {
	// Always return nil when linting is disabled (lint.Reserved == 0).
	if errLevel == lint.Reserved {
		return nil
	}
	// without a lintPriv key to use to sign the tbsCertificate we can't lint it.
	if s.lintPriv == nil {
		return cferr.New(cferr.PrivateKeyError, cferr.Unavailable)
	}

	// The template's SignatureAlgorithm must be mutated to match the lintPriv or
	// x509.CreateCertificate will error because of the mismatch. At the time of
	// writing s.lintPriv is always an ECDSA private key. This switch will need to
	// be expanded if the lint key type is made configurable.
	switch s.lintPriv.(type) {
	case *ecdsa.PrivateKey:
		template.SignatureAlgorithm = x509.ECDSAWithSHA256
	default:
		return cferr.New(cferr.PrivateKeyError, cferr.KeyMismatch)
	}

	prelintBytes, err := x509.CreateCertificate(rand.Reader, &template, s.ca, template.PublicKey, s.lintPriv)
	if err != nil {
		return cferr.Wrap(cferr.CertificateError, cferr.Unknown, err)
	}
	prelintCert, err := zx509.ParseCertificate(prelintBytes)
	if err != nil {
		return cferr.Wrap(cferr.CertificateError, cferr.ParseFailed, err)
	}
	errorResults := map[string]lint.LintResult{}
	results := zlint.LintCertificateEx(prelintCert, lintRegistry)
	for name, res := range results.Results {
		if res.Status > errLevel {
			errorResults[name] = *res
		}
	}
	if len(errorResults) > 0 {
		return &LintError{
			ErrorResults: errorResults,
		}
	}
	return nil
}
```

自签名时调用 zlint 进行证书合法性校验。

##### 2.1.4.2. 证书模板

CSR 模板处理：

```go
// signer/local/local.go

	// 解析 CSR 模板
	csrTemplate, err := signer.ParseCertificateRequest(s, profile, block.Bytes)
	if err != nil {
		return nil, err
	}

	// Copy out only the fields from the CSR authorized by policy.
	safeTemplate := x509.Certificate{}
	// If the profile contains no explicit whitelist, assume that all fields
	// should be copied from the CSR.
	if profile.CSRWhitelist == nil {
		safeTemplate = *csrTemplate
	} else {
		// 如果设置了 CSR 模板白名单，则只放行白名单里的字段
		if profile.CSRWhitelist.Subject {
			safeTemplate.Subject = csrTemplate.Subject
		}
		if profile.CSRWhitelist.PublicKeyAlgorithm {
			safeTemplate.PublicKeyAlgorithm = csrTemplate.PublicKeyAlgorithm
		}
		if profile.CSRWhitelist.PublicKey {
			safeTemplate.PublicKey = csrTemplate.PublicKey
		}
		if profile.CSRWhitelist.SignatureAlgorithm {
			safeTemplate.SignatureAlgorithm = csrTemplate.SignatureAlgorithm
		}
		if profile.CSRWhitelist.DNSNames {
			safeTemplate.DNSNames = csrTemplate.DNSNames
		}
		if profile.CSRWhitelist.IPAddresses {
			safeTemplate.IPAddresses = csrTemplate.IPAddresses
		}
		if profile.CSRWhitelist.EmailAddresses {
			safeTemplate.EmailAddresses = csrTemplate.EmailAddresses
		}
		if profile.CSRWhitelist.URIs {
			safeTemplate.URIs = csrTemplate.URIs
		}
	}

	...

	// 用 hosts 字段覆盖 SAN
	OverrideHosts(&safeTemplate, req.Hosts)
```

生成证书序列号：

```go
		// RFC 5280 4.1.2.2:
		// Certificate users MUST be able to handle serialNumber
		// values up to 20 octets.  Conforming CAs MUST NOT use
		// serialNumber values longer than 20 octets.
		//
		// If CFSSL is providing the serial numbers, it makes
		// sense to use the max supported size.
		serialNumber := make([]byte, 20)
		_, err = io.ReadFull(rand.Reader, serialNumber)
		if err != nil {
			return nil, cferr.Wrap(cferr.CertificateError, cferr.Unknown, err)
		}

		// SetBytes interprets buf as the bytes of a big-endian
		// unsigned integer. The leading byte should be masked
		// off to ensure it isn't negative.
		serialNumber[0] &= 0x7F

		safeTemplate.SerialNumber = new(big.Int).SetBytes(serialNumber)
```

填充证书特殊字段：

```go
// signer/signer.go

	// 证书 OCSP 字段来自配置的 Profile OCSP URL
	if ocspURL = profile.OCSP; ocspURL == "" {
		ocspURL = defaultProfile.OCSP
	}

	if template.IsCA {
		template.MaxPathLen = profile.CAConstraint.MaxPathLen
		if template.MaxPathLen == 0 {
			template.MaxPathLenZero = profile.CAConstraint.MaxPathLenZero
		}
		// 如果是 CA 证书，则没有 SAN 字段
		template.DNSNames = nil
		template.EmailAddresses = nil
		template.URIs = nil
	}

	// 若设置 OCSP No Check
	if profile.OCSPNoCheck {
		ocspNoCheckExtension := pkix.Extension{
			Id:       asn1.ObjectIdentifier{1, 3, 6, 1, 5, 5, 7, 48, 1, 5},
			Critical: false,
			Value:    []byte{0x05, 0x00},
		}
		template.ExtraExtensions = append(template.ExtraExtensions, ocspNoCheckExtension)
	}
```

##### 2.1.4.3. 签名证书

```go
// signer/local/local.go
func (s *Signer) sign(template *x509.Certificate, lintErrLevel lint.LintStatus, lintRegistry lint.Registry) (cert []byte, err error) {
   var initRoot bool
   // 没有指定 cert
   if s.ca == nil {
      // 不是 ca 证书则报错
      if !template.IsCA {
         err = cferr.New(cferr.PolicyError, cferr.InvalidRequest)
         return
      }
      // ca 证书没有 SAN 字段
      template.DNSNames = nil
      template.EmailAddresses = nil
      template.URIs = nil
      s.ca = template
      initRoot = true
   }

   if err := s.lint(*template, lintErrLevel, lintRegistry); err != nil {
      return nil, err
   }

   // 签名证书
   derBytes, err := x509.CreateCertificate(rand.Reader, template, s.ca, template.PublicKey, s.priv)
   if err != nil {
      return nil, cferr.Wrap(cferr.CertificateError, cferr.Unknown, err)
   }
   if initRoot {
      s.ca, err = x509.ParseCertificate(derBytes)
      if err != nil {
         return nil, cferr.Wrap(cferr.CertificateError, cferr.ParseFailed, err)
      }
   }

   cert = pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes})
   log.Infof("signed certificate with serial number %d", template.SerialNumber)
   return
}
```

##### 2.1.4.4. 数据库储存

```go
// 如果设置了 DB 储存
if s.dbAccessor != nil {
   now := time.Now()
   var certRecord = certdb.CertificateRecord{
      Serial: certTBS.SerialNumber.String(),
      // this relies on the specific behavior of x509.CreateCertificate
      // which sets the AuthorityKeyId from the signer's SubjectKeyId
      AKI:        hex.EncodeToString(parsedCert.AuthorityKeyId),
      CALabel:    req.Label,
      Status:     "good",
      Expiry:     certTBS.NotAfter,
      PEM:        string(signedCert),
      IssuedAt:   &now,
      NotBefore:  &certTBS.NotBefore,
      CommonName: sql.NullString{String: certTBS.Subject.CommonName, Valid: true},
   }

   if err := certRecord.SetMetadata(req.Metadata); err != nil {
      return nil, err
   }
   if err := certRecord.SetSANs(certTBS.DNSNames); err != nil {
      return nil, err
   }

   // 在数据库创建一条 row
   if err := s.dbAccessor.InsertCertificate(certRecord); err != nil {
      return nil, err
   }
   log.Debug("saved certificate with serial number ", certTBS.SerialNumber)
}
```

#### 2.1.4. 导出文件

*cfssljson* Cmd 工作为接收请求返回，并将其通过 Pipeline 解析，输出到文件。

```go
// cmd/cfssljson/cfssljson.go
func readFile(filespec string) ([]byte, error) {
	if filespec == "-" {
		// 若参数为 "-"，则从 stdin 获取
		return ioutil.ReadAll(os.Stdin)
	}
	return ioutil.ReadFile(filespec)
}
```

解析成对应格式的文件并输出。

```go
	if contents, ok := input["cert"]; ok {
		cert = contents.(string)
	} else if contents, ok = input["certificate"]; ok {
		cert = contents.(string)
	}
	if cert != "" {
		outs = append(outs, outputFile{
			Filename: baseName + ".pem",
			Contents: cert,
			Perms:    0664,
		})
	}

	if contents, ok := input["key"]; ok {
		key = contents.(string)
	} else if contents, ok = input["private_key"]; ok {
		key = contents.(string)
	}
	if key != "" {
		outs = append(outs, outputFile{
			Filename: baseName + "-key.pem",
			Contents: key,
			Perms:    0600,
		})
	}

	for _, e := range outs {
		if *output {
			if e.IsBinary {
				e.Contents = base64.StdEncoding.EncodeToString([]byte(e.Contents))
			}
			fmt.Fprintf(os.Stdout, "%s\n", e.Contents)
		} else {
			writeFile(e.Filename, e.Contents, e.Perms)
		}
	}
```

#### 2.1.5. 证书 Bundle

> **CA bundle** is a file that contains root and  intermediate certificates. The end-entity certificate along with a CA  bundle constitutes the certificate chain.  

How do I make CA-bundle file from CRT files?

There are a few *.crt files in your package:

- **AddTrustExternalCARoot.crt** - Root CA Certificate
- **COMODORSAAddTrustCA.crt** - Intermediate CA Certificate 1
- **COMODORSADomainValidationSecureServerCA.crt** - Intermediate CA Certificate 2
- **yourDomain.crt** - Your SSL Certificate

CA-bundle is a file that contains root and intermediate certificates in the right order. The order must be:

\- Intermediate CA Certificate 2

\- Intermediate CA Certificate 1

\- Root CA Certificate

```bash
$ cat ComodoRSADomainValidationSecureServerCA.crt ComodoRSAAddTrustCA.crt AddTrustExternalCARoot.crt > yourDomain.ca-bundle
```

*cfssl bundle* 命令只用于生成包含 end-entry 证书的证书链，但在我们实际使用中，在 Workload 间传输的只是 Workload 证书，不会传输 CA 证书。

### 2.2. CA Server

#### 2.2.1. 启动

```go
// serverMain is the command line entry point to the API server. It sets up a
// new HTTP server to handle sign, bundle, and validate requests.
func serverMain(args []string, c cli.Config) error {
	
    ...

    // 初始化 signer
	if s, err = sign.SignerFromConfigAndDB(c, db); err != nil {
		log.Warningf("couldn't initialize signer: %v", err)
	}

    // 初始化 ocsp signer
	if ocspSigner, err = ocspsign.SignerFromConfig(c); err != nil {
		log.Warningf("couldn't initialize ocsp signer: %v", err)
	}

    // 注册 api handler
	registerHandlers()

	addr := net.JoinHostPort(conf.Address, strconv.Itoa(conf.Port))

	tlscfg := tls.Config{}
	if conf.MinTLSVersion != "" {
		tlscfg.MinVersion = helpers.StringTLSVersion(conf.MinTLSVersion)
	}

	if conf.TLSCertFile == "" || conf.TLSKeyFile == "" {
		log.Info("Now listening on ", addr)
		return http.ListenAndServe(addr, nil)
	}

    ...
	return server.ListenAndServeTLS(conf.TLSCertFile, conf.TLSKeyFile)

}
```

启动时流程：

1. 创建 Signer，参考 2.1.3 节
2. 注册 API Handler，处理 HTTP 请求
3. 启动 HTTP / TLS 服务器（支持 mTLS）

#### 2.2.2. 注册 API Handler

```go
// cli/serve/serve.go

var endpoints = map[string]func() (http.Handler, error){
	"sign": func() (http.Handler, error) {
		if s == nil {
			return nil, errBadSigner
		}

		h, err := signhandler.NewHandlerFromSigner(s)
		if err != nil {
			return nil, err
		}

		if conf.CABundleFile != "" && conf.IntBundleFile != "" {
			sh := h.Handler.(*signhandler.Handler)
			if err := sh.SetBundler(conf.CABundleFile, conf.IntBundleFile); err != nil {
				return nil, err
			}
		}

		return h, nil
	},

	"authsign": func() (http.Handler, error) {
		if s == nil {
			return nil, errBadSigner
		}

		h, err := signhandler.NewAuthHandlerFromSigner(s)
		if err != nil {
			return nil, err
		}

		if conf.CABundleFile != "" && conf.IntBundleFile != "" {
			sh := h.(*api.HTTPHandler).Handler.(*signhandler.AuthHandler)
			if err := sh.SetBundler(conf.CABundleFile, conf.IntBundleFile); err != nil {
				return nil, err
			}
		}

		return h, nil
	},

	"info": func() (http.Handler, error) {
		if s == nil {
			return nil, errBadSigner
		}
		return info.NewHandler(s)
	},

	"crl": func() (http.Handler, error) {
		if s == nil {
			return nil, errBadSigner
		}

		if db == nil {
			return nil, errNoCertDBConfigured
		}

		return crl.NewHandler(certsql.NewAccessor(db), conf.CAFile, conf.CAKeyFile)
	},

	"gencrl": func() (http.Handler, error) {
		if s == nil {
			return nil, errBadSigner
		}
		return gencrl.NewHandler(), nil
	},

	"newcert": func() (http.Handler, error) {
		if s == nil {
			return nil, errBadSigner
		}
		h := generator.NewCertGeneratorHandlerFromSigner(generator.CSRValidate, s)
		if conf.CABundleFile != "" && conf.IntBundleFile != "" {
			cg := h.(api.HTTPHandler).Handler.(*generator.CertGeneratorHandler)
			if err := cg.SetBundler(conf.CABundleFile, conf.IntBundleFile); err != nil {
				return nil, err
			}
		}
		return h, nil
	},

	"bundle": func() (http.Handler, error) {
		return bundle.NewHandler(conf.CABundleFile, conf.IntBundleFile)
	},

	"newkey": func() (http.Handler, error) {
		return generator.NewHandler(generator.CSRValidate)
	},

	"init_ca": func() (http.Handler, error) {
		return initca.NewHandler(), nil
	},

	"scan": func() (http.Handler, error) {
		return scan.NewHandler(conf.CABundleFile)
	},

	"scaninfo": func() (http.Handler, error) {
		return scan.NewInfoHandler(), nil
	},

	"certinfo": func() (http.Handler, error) {
		if db != nil {
			return certinfo.NewAccessorHandler(certsql.NewAccessor(db)), nil
		}

		return certinfo.NewHandler(), nil
	},

	"ocspsign": func() (http.Handler, error) {
		if ocspSigner == nil {
			return nil, errBadSigner
		}
		return apiocsp.NewHandler(ocspSigner), nil
	},

	"revoke": func() (http.Handler, error) {
		if db == nil {
			return nil, errNoCertDBConfigured
		}
		return revoke.NewHandler(certsql.NewAccessor(db)), nil
	},

	"/": func() (http.Handler, error) {
		if err := staticBox.findStaticBox(); err != nil {
			return nil, err
		}

		return http.FileServer(staticBox), nil
	},

	"health": func() (http.Handler, error) {
		return health.NewHealthCheck(), nil
	},
}
```

#### 2.2.3. OCSP

> Partly to combat these scalability issues, OCSP was introduced. OCSP  provides on-demand answers about the revocation status of a given  certificate. An OCSP responder is a service that returns signed answers  to the question "is this certificate revoked?". The response is either  "Yes" or "No". Each response is signed by the CA and has a validity  period so the client knows how long to cache the response.
>
> CFSSL now has an OCSP responder service that can be configured to run in a distributed way, without access to the CA. There are also OCSP  management tools in CFSSL to automatically populate the data for the  OCSP responder and keep it fresh using the certificate database.

![refreshing the OCSP responder](https://blog.cloudflare.com/content/images/2016/03/image_8.png)

OCSP 签名，和 OCSP 返回是独立的程序，利于分布式部署。

##### 2.2.3.1. OCSP Responder

介绍：

```go
// Usage text of 'cfssl serve'
var ocspServerUsageText = `cfssl ocspserve -- set up an HTTP server that handles OCSP requests from either a file or directly from a database (see RFC 5019)

  Usage of ocspserve:
          cfssl ocspserve [-address address] [-port port] [-responses file] [-db-config db-config]

  Flags:
  `
```

OCSP Server 能够在自定义的 Path 上启动：

```go
	log.Info("Registering OCSP responder handler")
	http.Handle(c.Path, ocsp.NewResponder(src, nil))
```

*cfssl* OCSP 处理请求接口：

```go
// ocsp/responder.go

// A Responder can process both GET and POST requests.  The mapping
// from an OCSP request to an OCSP response is done by the Source;
// the Responder simply decodes the request, and passes back whatever
// response is provided by the source.
// Note: The caller must use http.StripPrefix to strip any path components
// (including '/') on GET requests.
// Do not use this responder in conjunction with http.NewServeMux, because the
// default handler will try to canonicalize path components by changing any
// strings of repeated '/' into a single '/', which will break the base64
// encoding.
func (rs Responder) ServeHTTP(response http.ResponseWriter, request *http.Request) {

	...
    
	// Parse response as an OCSP request
	// XXX: This fails if the request contains the nonce extension.
	//      We don't intend to support nonces anyway, but maybe we
	//      should return unauthorizedRequest instead of malformed.
	ocspRequest, err := ocsp.ParseRequest(requestBody)

    ...
    
	// Look up OCSP response from source
	ocspResponse, headers, err := rs.Source.Response(ocspRequest)

    ...
    
	parsedResponse, err := ocsp.ParseResponse(ocspResponse, nil)

    ...

	response.WriteHeader(http.StatusOK)
	response.Write(ocspResponse)
}

```

OCSP 返回的内容实际上直接从数据库读取后返回：

```go
// ocsp/responder.go

// Response implements cfssl.ocsp.responder.Source, which returns the
// OCSP response in the Database for the given request with the expiration
// date furthest in the future.
func (src DBSource) Response(req *ocsp.Request) ([]byte, http.Header, error) {
	...
	records, err := src.Accessor.GetOCSP(strSN, aki)
	...
	return []byte(cur.Body), nil, nil
}
```

```go
// GetOCSP retrieves a certdb.OCSPRecord from db by serial.
func (d *Accessor) GetOCSP(serial, aki string) (ors []certdb.OCSPRecord, err error) {
	err = d.checkDB()
	if err != nil {
		return nil, err
	}

	err = d.db.Select(&ors, fmt.Sprintf(d.db.Rebind(selectOCSPSQL), sqlstruct.Columns(certdb.OCSPRecord{})), serial, aki)
	if err != nil {
		return nil, wrapSQLError(err)
	}

	return ors, nil
}
```

##### 2.2.3.2. OCSP Sign

OCSP 签名和返回是分开的，并且不会在创建证书一并创建。

![](/images/2021-11-01-07.png)场景1：OCSP 签名会在证书被吊销时创建。

```go
// cli/ocsprefresh/ocsprefresh.go

// ocsprefreshMain is the main CLI of OCSP refresh functionality.
func ocsprefreshMain(args []string, c cli.Config) error {
   ...

	s, err := SignerFromConfig(c)
	if err != nil {
		log.Critical("Unable to create OCSP signer: ", err)
		return err
	}

	db, err := dbconf.DBFromConfig(c.DBConfigFile)
	if err != nil {
		return err
	}

	dbAccessor := sql.NewAccessor(db)
	certs, err := dbAccessor.GetUnexpiredCertificates()
	if err != nil {
		return err
	}

	// Set an expiry timestamp for all certificates refreshed in this batch
	ocspExpiry := time.Now().Add(c.Interval)
	for _, certRecord := range certs {
		cert, err := helpers.ParseCertificatePEM([]byte(certRecord.PEM))
		if err != nil {
			log.Critical("Unable to parse certificate: ", err)
			return err
		}

		req := ocsp.SignRequest{
			Certificate: cert,
			Status:      certRecord.Status,
		}

		if certRecord.Status == "revoked" {
			req.Reason = int(certRecord.Reason)
			req.RevokedAt = certRecord.RevokedAt
		}

		resp, err := s.Sign(req)
		if err != nil {
			log.Critical("Unable to sign OCSP response: ", err)
			return err
		}

		err = dbAccessor.UpsertOCSP(cert.SerialNumber.String(), hex.EncodeToString(cert.AuthorityKeyId), string(resp), ocspExpiry)
		if err != nil {
			log.Critical("Unable to save OCSP response: ", err)
			return err
		}
	}

	return nil
}
```

场景2：通过 `cfssl ocsprefresh` 命令执行。

二次开发时可以考虑将 OCSP 记录在签发证书时进行创建。

#### 2.2.4. API Client

`api/client` 包实现了 cfssl 的 API 客户端。

```go
// A Remote points to at least one (but possibly multiple) remote
// CFSSL instances. It must be able to perform a authenticated and
// unauthenticated certificate signing requests, return information
// about the CA on the other end, and return a list of the hosts that
// are used by the remote.
type Remote interface {
   AuthSign(req, id []byte, provider auth.Provider) ([]byte, error)
   Sign(jsonData []byte) ([]byte, error)
   Info(jsonData []byte) (*info.Resp, error)
   Hosts() []string
   SetReqModifier(func(*http.Request, []byte))
   SetRequestTimeout(d time.Duration)
   SetProxy(func(*http.Request) (*url.URL, error))
}
```

主要功能为 API 接口和参数的封装。会在下一节中被用到。

##### 2.2.4.1. 获取 CA 证书

```go
// signer/local/local.go

// 获取 CA Info
// Info return a populated info.Resp struct or an error.
func (s *Signer) Info(req info.Req) (resp *info.Resp, err error) {
	cert, err := s.Certificate(req.Label, req.Profile)
	if err != nil {
		return
	}

	profile, err := signer.Profile(s, req.Profile)
	if err != nil {
		return
	}

	resp = new(info.Resp)
	if cert.Raw != nil {
		resp.Certificate = string(bytes.TrimSpace(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert.Raw})))
	}
	resp.Usage = profile.Usage
	resp.ExpiryString = profile.ExpiryString

	return
}
```

返回服务端的 CA 证书，该证书会用在 Client 的 TrustRoot 中。

问题点：Root CA 证书没有被加载到程序中，需要在服务端增加 Root 证书的返回值。

#### 2.2.5. 证书吊销

##### 2.2.5.1. 吊销接口

证书吊销接口支持三个参数：

```sql
UPDATE certificates
	SET status='revoked', revoked_at=CURRENT_TIMESTAMP, reason=:reason
	WHERE (serial_number = :serial_number AND authority_key_identifier = :authority_key_identifier);
```

证书序列号和 AKI 定位一个证书。

```go
// api/revoke/revoke.go

	// If we were given a signer, try and generate an OCSP
	// response indicating revocation
	if h.Signer != nil {
		// TODO: should these errors be errors?
		// Grab the certificate from the database
		cr, err := h.dbAccessor.GetCertificate(req.Serial, req.AKI)
		if err != nil {
			return err
		}
		if len(cr) != 1 {
			return errors.NewBadRequestString("No unique certificate found")
		}

		cert, err := helpers.ParseCertificatePEM([]byte(cr[0].PEM))
		if err != nil {
			return errors.NewBadRequestString("Unable to parse certificates from PEM data")
		}

		sr := ocsp.SignRequest{
			Certificate: cert,
			Status:      "revoked",
			Reason:      reasonCode,
			RevokedAt:   time.Now().UTC(),
		}

		ocspResponse, err := h.Signer.Sign(sr)
		if err != nil {
			return err
		}

		// We parse the OCSP response in order to get the next
		// update time/expiry time
		ocspParsed, err := stdocsp.ParseResponse(ocspResponse, nil)
		if err != nil {
			return err
		}

		ocspRecord := certdb.OCSPRecord{
			Serial: req.Serial,
			AKI:    req.AKI,
			Body:   string(ocspResponse),
			Expiry: ocspParsed.NextUpdate,
		}

		if err = h.dbAccessor.InsertOCSP(ocspRecord); err != nil {
			return err
		}
	}
```

证书吊销时会进行 OCSP 签名，创建一个吊销状态的 OCSP Response。

##### 2.2.5.2. 查询证书吊销

证书吊销没有主动通知机制，如何感应到证书已经被吊销？

https://github.com/snowflakedb/gosnowflake/issues/5

> Here are the steps to implement the revocation checks with OCSP:
>
> - Check if certificate validation can be intercepted to add revocation checks (Yes. TLSClientConfig including verifyPeerCertificate can be  injected in Client)
> - Extract OCSP URL from the certificate
> - Make sure OCSP Request can be composed.
> - Make sure a simple roundtrip with OCSP server returns OCSP Response and can be decoded.
> - Make sure OCSP Response can include enough information to validate the revocation status.
> - Implement concurrent OCSP round trips for chained certificates.
> - Implement caching the results in a cache directory

通过实现 `tls.Config.VerifyPeerCertificate` 方法，我们可以自定义实现 OCSP 查询：

```go
    // VerifyPeerCertificate, if not nil, is called after normal
    // certificate verification by either a TLS client or server. It
    // receives the raw ASN.1 certificates provided by the peer and also
    // any verified chains that normal processing found. If it returns a
    // non-nil error, the handshake is aborted and that error results.
    //
    // If normal verification fails then the handshake will abort before
    // considering this callback. If normal verification is disabled by
    // setting InsecureSkipVerify, or (for a server) when ClientAuth is
    // RequestClientCert or RequireAnyClientCert, then this callback will
    // be considered but the verifiedChains argument will always be nil.
    VerifyPeerCertificate func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error // Go 1.8
```

认证 OCSP 的示例代码 https://github.com/snowflakedb/gosnowflake/blob/master/ocsp.go：

```go
// verifyPeerCertificate verifies all of certificate revocation status
func verifyPeerCertificate(ctx context.Context, verifiedChains [][]*x509.Certificate) (err error) {
	for i := 0; i < len(verifiedChains); i++ {
		// Certificate signed by Root CA. This should be one before the last in the Certificate Chain
		numberOfNoneRootCerts := len(verifiedChains[i]) - 1
		if !verifiedChains[i][numberOfNoneRootCerts].IsCA || string(verifiedChains[i][numberOfNoneRootCerts].RawIssuer) != string(verifiedChains[i][numberOfNoneRootCerts].RawSubject) {
			// Check if the last Non Root Cert is also a CA or is self signed.
			// if the last certificate is not, add it to the list
			rca := caRoot[string(verifiedChains[i][numberOfNoneRootCerts].RawIssuer)]
			if rca == nil {
				return fmt.Errorf("failed to find root CA. pkix.name: %v", verifiedChains[i][numberOfNoneRootCerts].Issuer)
			}
			verifiedChains[i] = append(verifiedChains[i], rca)
			numberOfNoneRootCerts++
		}
		results := getAllRevocationStatus(ctx, verifiedChains[i])
		if r := canEarlyExitForOCSP(results, numberOfNoneRootCerts); r != nil {
			return r.err
		}
	}

	ocspResponseCacheLock.Lock()
	if cacheUpdated {
		writeOCSPCacheFile()
	}
	cacheUpdated = false
	ocspResponseCacheLock.Unlock()
	return nil
}
```

### 2.3. Transport

我称呼它为 Workload SDK。

我们后续的 Workload SDK 是基于此包修改而来。本质上与 Istio Pilot Agent 的 CA Client 类似。

![Certificate Issuance](https://blog.cloudflare.com/content/images/2016/03/image_3.png)

我发现上图中 cfssl 把 "OCSP" 写成了 "OSCP"，🤣。

#### 2.3.1. 配置项

配置项作为一个特性，在 CFSSL 的官方文档中被提到。

```go
{
  "request": {
    "CN": "test server",
    "hosts": ["127.0.0.1"]
  },
  "profiles": {
    "paths": {
      "private_key": "server.key",
      "certificate": "server.pem"
    },
    "cfssl": {
      "profile": "server",
      "remote": "127.0.0.1:8888",
      "auth-type": "standard",
      "auth-key": "4f4f26686209f672e0ec7b19cbbc8b6d94fdd12cc0b20326f9005d5f234e6e3e"
    }
  },
  "roots": [{
    "type": "system"
  }],
  "client_roots": [{
    "type": "cfssl",
    "metadata": {
      "host": "127.0.0.1:8888",
      "profile": "client"
    }
  }]
}
```

`roots` 以及 `client_roots` 是用来配置 System Trust Store 和 Client Trust Store 的。

```go
	// TrustStore contains the certificates trusted by this
	// transport.
	TrustStore *roots.TrustStore

	// ClientTrustStore contains the certificate authorities to
	// use in verifying client authentication certificates.
	ClientTrustStore *roots.TrustStore
```

#### 2.3.2. TrustStore

> A **TrustStore** holds the certificates of external systems that you trust. So a **TrustStore** is a KeyStore file, that contains the public keys/certificate of external hosts that you trust.

##### 2.3.2.1. System Cert Pool

*cfssl* 源码中将 Golang 官方 x509 包中 system 部分 copy 到了 `transport/roots/system` 目录下，用于创建系统信任的 CA 证书池，但没有对 Windows 进行处理，导致在 Windows 上出现报错。

我对其进行了更改，其功能没有发生变化，但不会出现编译报错：

```go
// transport/roots/system.go

func NewSystem(_ map[string]string) ([]*x509.Certificate, error) {
	var certs []*x509.Certificate
	certpool, err := x509.SystemCertPool()
	if err != nil {
		// 返回 nil，否则 panic
		return nil, nil
	}
	for _, pem := range certpool.Subjects() {
		cert, err := helpers.ParseCertificatesPEM(pem)
		if err != nil {
			return nil, err
		}
		certs = append(certs, cert...)
	}
	return certs, nil
}
```

查看 Golang 官方 x509 包中：

```go
func SystemCertPool() (*CertPool, error) {
	if runtime.GOOS == "windows" {
		// Issue 16736, 18609:
		return nil, errors.New("crypto/x509: system root pool is not available on Windows")
	}
	...
	return loadSystemRoots()
}
```

Windows 获取不到 system root pool。

Linux 中的系统内置 CA 证书在：

```go
// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package x509

// Possible certificate files; stop after finding one.
var certFiles = []string{
    "/etc/ssl/certs/ca-certificates.crt",                // Debian/Ubuntu/Gentoo etc.
    "/etc/pki/tls/certs/ca-bundle.crt",                  // Fedora/RHEL 6
    "/etc/ssl/ca-bundle.pem",                            // OpenSUSE
    "/etc/pki/tls/cacert.pem",                           // OpenELEC
    "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem", // CentOS/RHEL 7
    "/etc/ssl/cert.pem",                                 // Alpine Linux
}
```

##### 2.3.2.2. 获取 CA 证书

```go
// transport/roots/provider.go

// A TrustStore contains a pool of certificate that are trusted for a
// given TLS configuration.
type TrustStore struct {
   roots map[string]*x509.Certificate
}

// New produces a new trusted root provider from a collection of
// roots. If there are no roots, the system roots will be used.
func New(rootDefs []*core.Root) (*TrustStore, error) {
	var err error

	var store = &TrustStore{}
	var roots []*x509.Certificate

    ...
    
	err = errors.New("transport: no supported root providers found")
	for _, root := range rootDefs {
		pfn, ok := Providers[root.Type]
		if ok {
			roots, err = pfn(root.Metadata)
			if err != nil {
				break
			}

			store.addCerts(roots)
		}
	}
	...
	return store, err
}
```

当我们添加一个 CA 证书来源时，程序会调用 `Providers[root.Type]()` 获取 CA 证书。

支持的 CA 证书来源有：

```go
// Providers is a mapping of supported providers and the functions
// that can build them.
var Providers = map[string]func(map[string]string) ([]*x509.Certificate, error){
	"system": NewSystem,
	"cfssl":  NewCFSSL,
	"file":   TrustPEM,
}
```

其中 *cfssl* 源获取 CA 证书方法如下：

```go
// transport/roots/cfssl.go

// NewCFSSL produces a new CFSSL root.
func NewCFSSL(metadata map[string]string) ([]*x509.Certificate, error) {
	host, ok := metadata["host"]
	if !ok {
		return nil, errors.New("transport: CFSSL root provider requires a host")
	}

	label := metadata["label"]
	profile := metadata["profile"]
    // 这里获取不到证书会返回 nil，不会报错
	cert, err := helpers.LoadClientCertificate(metadata["mutual-tls-cert"], metadata["mutual-tls-key"])
	if err != nil {
		return nil, err
	}
    // 这里获取不到证书会返回 nil，不会报错
	remoteCAs, err := helpers.LoadPEMCertPool(metadata["tls-remote-ca"])
	if err != nil {
		return nil, err
	}
    // 创建 http/https 客户端
	srv := client.NewServerTLS(host, helpers.CreateTLSConfig(remoteCAs, cert))
	data, err := json.Marshal(info.Req{Label: label, Profile: profile})
	if err != nil {
		return nil, err
	}

    // 调用 "info" API 接口
	resp, err := srv.Info(data)
	if err != nil {
		return nil, err
	}

	return helpers.ParseCertificatesPEM([]byte(resp.Certificate))
}
```

客户端会调用 2.2.4.1 节的接口。

#### 2.3.3. CA Provider

又名 Cert Provider。

```go
// A CertificateAuthority is capable of signing certificates given
// certificate signing requests.
type CertificateAuthority interface {
	// SignCSR submits a PKCS #10 certificate signing request to a
	// CA for signing.
	SignCSR(csrPEM []byte) (cert []byte, err error)

	// CACertificate returns the certificate authority's
	// certificate.
	CACertificate() (cert []byte, err error)
}
```

用于与 CA 进行通信。

```go
// transport/ca/cfssl_provider.go

// SignCSR requests a certificate from a CFSSL signer.
func (cap *CFSSL) SignCSR(csrPEM []byte) (cert []byte, err error) {
	p, _ := pem.Decode(csrPEM)
	if p == nil || p.Type != "CERTIFICATE REQUEST" {
		return nil, errors.New("transport: invalid PEM-encoded certificate signing request")
	}

	csr, err := x509.ParseCertificateRequest(p.Bytes)
	if err != nil {
		return nil, err
	}

	// 原来这个地方不支持 SAN URI
	hosts := make([]string, len(csr.DNSNames), len(csr.DNSNames)+len(csr.IPAddresses)+len(csr.URIs))
	copy(hosts, csr.DNSNames)

	for i := range csr.IPAddresses {
		hosts = append(hosts, csr.IPAddresses[i].String())
	}

	for i := range csr.URIs {
		hosts = append(hosts, csr.URIs[i].String())
	}

	sreq := &signer.SignRequest{
		Hosts:   hosts,
		Request: string(csrPEM),
		Profile: cap.Profile,
		Label:   cap.Label,
	}

	out, err := json.Marshal(sreq)
	if err != nil {
		return nil, err
	}

	if cap.provider != nil {
		return cap.remote.AuthSign(out, nil, cap.provider)
	}

	return cap.remote.Sign(out)
}
```

向 CA 中心发送 CSR 请求。

#### 2.3.4. Key Provider

```go
// transport/kp/key_provider.go

// A KeyProvider provides some mechanism for managing private keys and
// certificates. It is not required to store the crypto.Signer itself.
type KeyProvider interface {
   // Certificate returns the associated certificate, or nil if
   // one isn't ready.
   Certificate() *x509.Certificate

   // Given some metadata about a certificate request, the
   // provider should be able to generate a new CSR.
   CertificateRequest(*csr.CertificateRequest) ([]byte, error)

   // Check returns an error if the provider has an invalid setup.
   Check() error

   // Generate should trigger the creation of a new private
   // key. This will invalidate any certificates stored in the
   // key provider.
   Generate(algo string, size int) error

   // Load causes a private key and certificate associated with
   // this provider to be loaded into memory and be prepared for
   // use.
   Load() error

   // Persistent returns true if the provider keeps state on disk.
   Persistent() bool

   // Ready returns true if the provider has a key and
   // certificate.
   Ready() bool

   // SetCertificatePEM takes a PEM-encoded certificate and
   // associates it with this key provider.
   SetCertificatePEM([]byte) error

   // SignalFailure is used to notify the KeyProvider that an
   // error has occurred obtaining a certificate. If this returns
   // true, the caller should re-attempt to refresh the
   // keys. This, for example, can be used to implement failover
   // key providers that require different keys.
   SignalFailure(err error) bool

   // SignCSR allows a templated CSR to be signed.
   SignCSR(csr *x509.CertificateRequest) ([]byte, error)

   // Store should perform whatever actions are necessary such
   // that a call to Load later will reload the key and
   // certificate associated with this provider.
   Store() error

   // X509KeyPair returns a tls.Certficate. The returns
   // tls.Certificate should have a parsed Leaf certificate.
   X509KeyPair() (tls.Certificate, error)
}
```

可以看到 Key Provider 是给 Workload 以生成私钥、CSR、请求证书、持久化的能力。

我们对该 package 进行了改造，在上层（Capitalizone）进行了重写，以配合 SPIFFE ID 共同工作。

#### 2.3.5. 生命周期

`cfssl/transport` 包提供了 mTLS 连接的封装，包括证书轮转功能。

```go
// transport/client.go

// A Transport is capable of providing transport-layer security using
// TLS.
type Transport struct {
	// Before defines how long before the certificate expires the
	// transport should start attempting to refresh the
	// certificate. For example, if this is 24h, then 24 hours
	// before the certificate expires the Transport will start
	// attempting to replace it.
	Before time.Duration

	// Provider contains a key management provider.
	Provider kp.KeyProvider

	// CA contains a mechanism for obtaining signed certificates.
	CA ca.CertificateAuthority

	// TrustStore contains the certificates trusted by this
	// transport.
	TrustStore *roots.TrustStore

	// ClientTrustStore contains the certificate authorities to
	// use in verifying client authentication certificates.
	ClientTrustStore *roots.TrustStore

	// Identity contains information about the entity that will be
	// used to construct certificates.
	Identity *core.Identity

	// Backoff is used to control the behaviour of a Transport
	// when it is attempting to automatically update a certificate
	// as part of AutoUpdate.
	Backoff *backoff.Backoff

	// RevokeSoftFail, if true, will cause a failure to check
	// revocation (such that the revocation status of a
	// certificate cannot be checked) to not be treated as an
	// error.
	RevokeSoftFail bool
}
```

这里同时将描述 mTLS 通信的整个流程。

##### 2.3.5.1. 获取证书

> In a TLS handshake, the certificate presented by a remote server is sent alongside the `ServerHello` message. At this point in the connection, the remote server has received the `ClientHello` message, and that is all the information it needs to decide which certificate to present to the connecting client.

<img src="https://diogomonica.com/content/images/2017/01/begining-tls-handshake-1.png" width="400" />

ServerHello 阶段会传输证书，这里涉及到一个问题：如何热更新证书。

>It turns out that Go supports passing a callback in a TLS Config that will get executed every time a TLS `ClientHello` is sent by a remote peer. This method is conveniently called `GetCertificate`, and it returns the certificate we wish to use for that particular TLS handshake.
>
>The idea of `GetCertificate` is to allow the dynamic  selection of which certificate to provide to a particular remote peer.  This method can be used to support virtual hosts, where one web server  is responsible for multiple domains, and therefore has to choose the  appropriate certificate to return to each remote peer.

Golang 的 tls 包提供了获取证书的函数支持：

```go
    // GetCertificate returns a Certificate based on the given
    // ClientHelloInfo. It will only be called if the client supplies SNI
    // information or if Certificates is empty.
    //
    // If GetCertificate is nil or returns nil, then the certificate is
    // retrieved from NameToCertificate. If NameToCertificate is nil, the
    // best element of Certificates will be used.
    GetCertificate func(*ClientHelloInfo) (*Certificate, error) // Go 1.4

    // GetClientCertificate, if not nil, is called when a server requests a
    // certificate from a client. If set, the contents of Certificates will
    // be ignored.
    //
    // If GetClientCertificate returns an error, the handshake will be
    // aborted and that error will be returned. Otherwise
    // GetClientCertificate must return a non-nil Certificate. If
    // Certificate.Certificate is empty then no certificate will be sent to
    // the server. If this is unacceptable to the server then it may abort
    // the handshake.
    //
    // GetClientCertificate may be called multiple times for the same
    // connection if renegotiation occurs or if TLS 1.3 is in use.
    GetClientCertificate func(*CertificateRequestInfo) (*Certificate, error) // Go 1.8
```

每次 TLS 握手时，`GetCertificate` / `GetClientCertificate` 方法会被调用，我们能够实现这个方法，动态更新证书。

[示例代码](https://diogomonica.com/2017/01/11/hitless-tls-certificate-rotation-in-go/)：

```go
type wrappedCertificate struct {
	sync.Mutex
	certificate *tls.Certificate
}

func (c *wrappedCertificate) getCertificate(clientHello *tls.ClientHelloInfo) (*tls.Certificate, error) {
	c.Lock()
	defer c.Unlock()

	return c.certificate, nil
}
```

<img src="https://diogomonica.com/content/images/2017/01/golang-new-certificate-being-served.png" height="400" />

> Old established connections using the previous certificate will remain  active, but new connections coming in to our TLS server will use the  most recent certificate.

##### 2.3.5.2. 证书轮转

```go
// transport/client.go

// AutoUpdate will automatically update the listener. If a non-nil
// certUpdates chan is provided, it will receive timestamps for
// reissued certificates. If errChan is non-nil, any errors that occur
// in the updater will be passed along.
func (tr *Transport) AutoUpdate(certUpdates chan<- time.Time, errChan chan<- error) {
	defer func() {
		if r := recover(); r != nil {
			log.Criticalf("AutoUpdate panicked: %v", r)
		}
	}()

	for {
		// Wait until it's time to update the certificate.
		target := time.Now().Add(tr.Lifespan())
		if PollInterval == 0 {
			<-time.After(tr.Lifespan())
		} else {
			pollWait(target)
		}

		// Keep trying to update the certificate until it's
		// ready.
		for {
			log.Debugf("attempting to refresh keypair")
			err := tr.RefreshKeys()
			if err == nil {
				break
			}

			delay := tr.Backoff.Duration()
			log.Debugf("failed to update certificate, will try again in %s", delay)
			if errChan != nil {
				errChan <- err
			}

			<-time.After(delay)
		}

		log.Debugf("certificate updated")
		if certUpdates != nil {
			certUpdates <- time.Now()
		}

		tr.Backoff.Reset()
	}
}
```

该方法会保持一个协程运行，检查证书有效时间，定时更新证书。

##### 2.3.5.3. CA 证书认证

```go
// transport/client.go

// TLSClientAuthClientConfig returns a new client authentication TLS
// configuration that can be used for a client using client auth
// connecting to the named host.
func (tr *Transport) TLSClientAuthClientConfig(host string) (*tls.Config, error) {
	cert, err := tr.getCertificate()
	if err != nil {
		return nil, err
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      tr.TrustStore.Pool(),
		ServerName:   host,
		CipherSuites: core.CipherSuites,
		MinVersion:   tls.VersionTLS12,
		ClientAuth:   tls.RequireAndVerifyClientCert,
	}, nil
}

// TLSClientAuthServerConfig returns a new client authentication TLS
// configuration for servers expecting mutually authenticated
// clients. The clientAuth parameter should contain the root pool used
// to authenticate clients.
func (tr *Transport) TLSClientAuthServerConfig() (*tls.Config, error) {
	logger.DEBUG.Print("------------------------ 获取服务器证书")
	cert, err := tr.getCertificate()
	if err != nil {
		return nil, err
	}

	logger.DEBUG.Print("------------------------ OK 服务器证书")
	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		RootCAs:      tr.TrustStore.Pool(),
		ClientCAs:    tr.ClientTrustStore.Pool(),
		ClientAuth:   tls.RequireAndVerifyClientCert,
		CipherSuites: core.CipherSuites,
		MinVersion:   tls.VersionTLS12,
	}, nil
}
```

Server 端和 Client 端的区别在于：

1. Server 端 `tls.Config` 需要 `ClientCAs` 参数
2. Client 端需要 `ServerName` 参数

Server 端的  `ClientCAs` 和 Client 端的 `RootCAs` 需要包含 Root CA 和 ICA 证书。

##### 2.3.5.4. 证书验证

除了一般的证书校验以外，Istio 还通过自定义校验方法，进行了 SPIFFE ID 的验证。

```go
    // VerifyPeerCertificate, if not nil, is called after normal
    // certificate verification by either a TLS client or server. It
    // receives the raw ASN.1 certificates provided by the peer and also
    // any verified chains that normal processing found. If it returns a
    // non-nil error, the handshake is aborted and that error results.
    //
    // If normal verification fails then the handshake will abort before
    // considering this callback. If normal verification is disabled by
    // setting InsecureSkipVerify, or (for a server) when ClientAuth is
    // RequestClientCert or RequireAnyClientCert, then this callback will
    // be considered but the verifiedChains argument will always be nil.
    VerifyPeerCertificate func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error // Go 1.8

    // VerifyConnection, if not nil, is called after normal certificate
    // verification and after VerifyPeerCertificate by either a TLS client
    // or server. If it returns a non-nil error, the handshake is aborted
    // and that error results.
    //
    // If normal verification fails then the handshake will abort before
    // considering this callback. This callback will run for all connections
    // regardless of InsecureSkipVerify or ClientAuth settings.
    VerifyConnection func(ConnectionState) error // Go 1.15
```

`VerifyPeerCertificate` 里能够提供 SPIFFE 的认证，`VerifyConnection` 能够通过 SDK 提供自定义认证。
