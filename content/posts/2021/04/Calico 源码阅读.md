---
title: Calico 源码阅读
date: 2021-04-27
draft: true
---
# Calico 源码阅读

[TOC]

## 一、配置文件

### 1.1 Kubeadm

```yaml
kind: ConfigMap
apiVersion: v1
metadata:
  name: kubeadm-config
  namespace: kube-system
data:
  ClusterConfiguration: |
    apiServer:
      certSANs:
      - kubernetes
      - kubernetes.default
      - kubernetes.default.svc
      - kubernetes.default.svc.k8s.sh
      - 10.14.0.1
      - localhost
      - 127.0.0.1
      - dev-master-33-163
      - dev-master-33-164
      - dev-master-33-167
      - lb-apiserver.kubernetes.local
      - 192.168.0.37
      - 47.102.39.183
      - 192.168.33.163
      - 192.168.33.164
      - 192.168.33.167
      - izuf6fj3i156smn8um2bjez
      - izuf6fj3i156smn8um2bjgz
      - izuf6fj3i156smn8um2bjfz
      extraArgs:
        allow-privileged: "true"
        anonymous-auth: "True"
        apiserver-count: "3"
        audit-log-maxage: "30"
        audit-log-maxbackup: "1"
        audit-log-maxsize: "100"
        audit-log-path: /var/log/audit/kube-apiserver-audit.log
        audit-policy-file: /etc/kubernetes/audit-policy/apiserver-audit-policy.yaml
        authorization-mode: Node,RBAC
        bind-address: 0.0.0.0
        enable-aggregator-routing: "False"
        endpoint-reconciler-type: lease
        event-ttl: 1h0m0s
        insecure-port: "0"
        kubelet-preferred-address-types: InternalDNS,InternalIP,Hostname,ExternalDNS,ExternalIP
        profiling: "False"
        request-timeout: 1m0s
        service-node-port-range: 30000-32767
        storage-backend: etcd3
      extraVolumes:
      - hostPath: /etc/kubernetes/audit-policy
        mountPath: /etc/kubernetes/audit-policy
        name: audit-policy
      - hostPath: /var/log/kubernetes/audit
        mountPath: /var/log/audit
        name: audit-logs
      - hostPath: /usr/share/ca-certificates
        mountPath: /usr/share/ca-certificates
        name: usr-share-ca-certificates
        readOnly: true
      timeoutForControlPlane: 5m0s
    apiVersion: kubeadm.k8s.io/v1beta2
    certificatesDir: /etc/kubernetes/ssl
    clusterName: k8s.sh
    controlPlaneEndpoint: 192.168.33.167:6443
    controllerManager:
      extraArgs:
        bind-address: 0.0.0.0
        configure-cloud-routes: "false"
        node-cidr-mask-size: "24"
        node-monitor-grace-period: 40s
        node-monitor-period: 5s
        pod-eviction-timeout: 5m0s
        profiling: "False"
        terminated-pod-gc-threshold: "12500"
    dns:
      imageRepository: tu6zof29.mirror.aliyuncs.com/coredns
      imageTag: 1.6.7
      type: CoreDNS
    etcd:
      external:
        caFile: /etc/ssl/etcd/ssl/ca.pem
        certFile: /etc/ssl/etcd/ssl/node-dev-master-33-167.pem
        endpoints:
        - https://192.168.33.162:2379
        - https://192.168.33.165:2379
        - https://192.168.33.166:2379
        keyFile: /etc/ssl/etcd/ssl/node-dev-master-33-167-key.pem
    imageRepository: harbor.oneitfarm.com/gcr
    kind: ClusterConfiguration
    kubernetesVersion: v1.17.12
    networking:
      dnsDomain: k8s.sh
      podSubnet: 10.32.0.0/13
      serviceSubnet: 10.14.0.0/15
    scheduler:
      extraArgs:
        bind-address: 0.0.0.0
  ClusterStatus: |
    apiEndpoints:
      dev-master-33-163:
        advertiseAddress: 192.168.33.163
        bindPort: 6443
      dev-master-33-164:
        advertiseAddress: 192.168.33.164
        bindPort: 6443
      dev-master-33-167:
        advertiseAddress: 192.168.33.167
        bindPort: 6443
    apiVersion: kubeadm.k8s.io/v1beta2
    kind: ClusterStatus
```

Calico Node 寻找并尝试获取由 Master 节点维护的集群配置文件，获取网络配置相关的信息。

例如 Kubeadm / Rancher。

### 1.2 Calico Node

```yaml
kind: Pod
apiVersion: v1
metadata:
  name: calico-node-mfj8l
  generateName: calico-node-
  namespace: kube-system
  labels:
    controller-revision-hash: 5bdcfbf854
    k8s-app: calico-node
    pod-template-generation: '10'
  annotations:
    kubespray.etcd-cert/serial: 6A98D698F7F7FEEB7571C818314B294861F51F8A
    prometheus.io/port: '9091'
    prometheus.io/scrape: 'true'
spec:
  volumes:
    - name: lib-modules
      hostPath:
        path: /lib/modules
        type: ''
    - name: var-run-calico
      hostPath:
        path: /var/run/calico
        type: '' # 	Empty string (default) is for backward compatibility, which means that no checks will be performed before mounting the hostPath volume.
        # ref: https://kubernetes.io/docs/concepts/storage/volumes/#hostpath
    - name: var-lib-calico
      hostPath:
        path: /var/lib/calico
        type: ''
    - name: cni-net-dir
      hostPath:
        path: /etc/cni/net.d
        type: ''
    - name: cni-bin-dir
      hostPath:
        path: /opt/cni/bin
        type: ''
    - name: etcd-certs
      hostPath:
        path: /etc/calico/certs
        type: ''
    - name: xtables-lock
      hostPath:
        path: /run/xtables.lock
        type: FileOrCreate
    - name: calico-node-token-9lp7n
      secret:
        secretName: calico-node-token-9lp7n
        defaultMode: 420
  initContainers:
    - name: install-cni
      image: 'tu6zof29.mirror.aliyuncs.com/calico/cni:v3.15.2'
      command:
        - /install-cni.sh
      env:
        - name: CNI_CONF_NAME
          value: 10-calico.conflist
        - name: UPDATE_CNI_BINARIES
          value: 'true'
        - name: CNI_NETWORK_CONFIG_FILE
          value: /host/etc/cni/net.d/calico.conflist.template
        - name: SLEEP
          value: 'false'
      resources: {}
      volumeMounts:
        - name: cni-net-dir
          mountPath: /host/etc/cni/net.d
        - name: cni-bin-dir
          mountPath: /host/opt/cni/bin
        - name: calico-node-token-9lp7n
          readOnly: true
          mountPath: /var/run/secrets/kubernetes.io/serviceaccount
      terminationMessagePath: /dev/termination-log
      terminationMessagePolicy: File
      imagePullPolicy: IfNotPresent
      securityContext:
        privileged: true
  containers:
    - name: calico-node
      image: 'tu6zof29.mirror.aliyuncs.com/calico/node:v3.15.2'
      env:
        - name: ETCD_ENDPOINTS
          valueFrom:
            configMapKeyRef:
              name: calico-config
              key: etcd_endpoints
        - name: ETCD_CA_CERT_FILE
          valueFrom:
            configMapKeyRef:
              name: calico-config
              key: etcd_ca
        - name: ETCD_KEY_FILE
          valueFrom:
            configMapKeyRef:
              name: calico-config
              key: etcd_key
        - name: ETCD_CERT_FILE
          valueFrom:
            configMapKeyRef:
              name: calico-config
              key: etcd_cert
        - name: CALICO_NETWORKING_BACKEND
          valueFrom:
            configMapKeyRef:
              name: calico-config
              key: calico_backend
        - name: CLUSTER_TYPE
          valueFrom:
            configMapKeyRef:
              name: calico-config
              key: cluster_type
        - name: CALICO_K8S_NODE_REF
          valueFrom:
            fieldRef:
              apiVersion: v1
              fieldPath: spec.nodeName
        - name: CALICO_DISABLE_FILE_LOGGING
          value: 'true'
        - name: FELIX_DEFAULTENDPOINTTOHOSTACTION
          value: RETURN
        - name: FELIX_HEALTHHOST
          value: localhost
        - name: FELIX_IPTABLESBACKEND
          value: Legacy
        - name: FELIX_IPTABLESLOCKTIMEOUTSECS
          value: '10'
        - name: CALICO_IPV4POOL_IPIP
          value: 'Off'
        - name: FELIX_IPV6SUPPORT
          value: 'false'
        - name: FELIX_LOGSEVERITYSCREEN
          value: info
        - name: FELIX_USAGEREPORTINGENABLED
          value: 'False'
        - name: FELIX_IPINIPMTU
          value: '1480'
        - name: FELIX_CHAININSERTMODE
          value: Insert
        - name: FELIX_PROMETHEUSMETRICSENABLED
          value: 'True'
        - name: FELIX_PROMETHEUSMETRICSPORT
          value: '9091'
        - name: FELIX_PROMETHEUSGOMETRICSENABLED
          value: 'True'
        - name: FELIX_PROMETHEUSPROCESSMETRICSENABLED
          value: 'True'
        - name: IP
          valueFrom:
            fieldRef:
              apiVersion: v1
              fieldPath: status.hostIP
        - name: NODENAME
          valueFrom:
            fieldRef:
              apiVersion: v1
              fieldPath: spec.nodeName
        - name: FELIX_HEALTHENABLED
          value: 'true'
        - name: FELIX_IGNORELOOSERPF
          value: 'False'
      resources:
        limits:
          cpu: 300m
          memory: 500M
        requests:
          cpu: 150m
          memory: 64M
      volumeMounts:
        - name: lib-modules
          readOnly: true
          mountPath: /lib/modules
        - name: var-run-calico
          mountPath: /var/run/calico
        - name: var-lib-calico
          mountPath: /var/lib/calico
        - name: etcd-certs
          mountPath: /calico-secrets
        - name: xtables-lock
          mountPath: /run/xtables.lock
        - name: calico-node-token-9lp7n
          readOnly: true
          mountPath: /var/run/secrets/kubernetes.io/serviceaccount
      livenessProbe:
        exec:
          command:
            - /bin/calico-node
            - '-felix-live'
            - '-bird-live'
        initialDelaySeconds: 5
        timeoutSeconds: 1
        periodSeconds: 10
        successThreshold: 1
        failureThreshold: 6
      readinessProbe:
        exec:
          command:
            - /bin/calico-node
            - '-bird-ready'
            - '-felix-ready'
        timeoutSeconds: 1
        periodSeconds: 10
        successThreshold: 1
        failureThreshold: 6
      terminationMessagePath: /dev/termination-log
      terminationMessagePolicy: File
      imagePullPolicy: IfNotPresent
      securityContext:
        privileged: true
  restartPolicy: Always
  terminationGracePeriodSeconds: 0
  dnsPolicy: ClusterFirst
  serviceAccountName: calico-node
  serviceAccount: calico-node
  nodeName: s001-w-33-187
  hostNetwork: true
  securityContext: {}
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchFields:
              - key: metadata.name
                operator: In
                values:
                  - s001-w-33-187
  schedulerName: default-scheduler
  tolerations:
    - operator: Exists
    - key: node.kubernetes.io/not-ready
      operator: Exists
      effect: NoExecute
    - key: node.kubernetes.io/unreachable
      operator: Exists
      effect: NoExecute
    - key: node.kubernetes.io/disk-pressure
      operator: Exists
      effect: NoSchedule
    - key: node.kubernetes.io/memory-pressure
      operator: Exists
      effect: NoSchedule
    - key: node.kubernetes.io/pid-pressure
      operator: Exists
      effect: NoSchedule
    - key: node.kubernetes.io/unschedulable
      operator: Exists
      effect: NoSchedule
    - key: node.kubernetes.io/network-unavailable
      operator: Exists
      effect: NoSchedule
  priorityClassName: system-node-critical
  priority: 2000001000
  enableServiceLinks: true
```

### 1.3 Calico Config

```yaml
kind: ConfigMap
apiVersion: v1
metadata:
  name: calico-config
  namespace: kube-system
  annotations:
    kubectl.kubernetes.io/last-applied-configuration: >
      {"apiVersion":"v1","data":{"calico_backend":"bird","cluster_type":"kubespray,bgp","etcd_ca":"/calico-secrets/ca_cert.crt","etcd_cert":"/calico-secrets/cert.crt","etcd_endpoints":"https://192.168.33.162:2379,https://192.168.33.165:2379,https://192.168.33.166:2379","etcd_key":"/calico-secrets/key.pem"},"kind":"ConfigMap","metadata":{"annotations":{},"name":"calico-config","namespace":"kube-system"}}
data:
  calico_backend: bird
  cluster_type: 'kubespray,bgp'
  etcd_ca: /calico-secrets/ca_cert.crt
  etcd_cert: /calico-secrets/cert.crt
  etcd_endpoints: >-
    https://192.168.33.162:2379,https://192.168.33.165:2379,https://192.168.33.166:2379
  etcd_key: /calico-secrets/key.pem
```

### 1.4 IP Pool

```bash
$ calicoctl get ipPool -o yaml
```

获取 IP Pool 资源。

```yaml
apiVersion: projectcalico.org/v3
items:
- apiVersion: projectcalico.org/v3
  kind: IPPool
  metadata:
    creationTimestamp: "2018-12-27T09:18:27Z"
    name: default-pool
    resourceVersion: "954"
    uid: 5e452ff5-09b8-11e9-bfed-00163e003d8a
  spec:
    blockSize: 26
    cidr: 10.32.0.0/13
    ipipMode: Always
    natOutgoing: true
    nodeSelector: all()
kind: IPPoolList
metadata:
  resourceVersion: "435384283"
```

> ref: https://github.com/kubernetes-sigs/kubespray/blob/7c86734d2e0bd2fc21b9acfcb4ec6b952aab23f3/roles/network_plugin/calico/defaults/main.yml#L11

IP Pool 资源可能会在集群初始化时由脚本完成创建，例如 Kubespray 在安装集群时会通过 calicocli 手动创建 IP Pool，并且默认启用 IPIP 模式。 

