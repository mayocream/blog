---
title: "Kubestronaut in 2024"
date: "2025-01-08T15:43:21+09:00"
toc: false
typeface: serif
---
In 2024, I received the Kubestronaut certification and achieved the 9th Kubestronaut in Japan. The Kubestronaut program starts in 2nd season of 2024 and holds a special page at [cncf.io/training/kubestronaut/](https://cncf.io/training/kubestronaut/). The program encourages individuals to take the CNCF Kubernetes examinations and get five certifications: [CKA](https://www.cncf.io/training/certification/cka/), [CKAD](https://www.cncf.io/training/certification/ckad/), [CKS](https://www.cncf.io/training/certification/cks/), [KCNA](https://www.cncf.io/training/certification/kcna/), and [KCSA](https://www.cncf.io/training/certification/kcsa/). It's actually the first program that benefits those who pass the certifications; you get the jacket and have the Kubestronaut network.

How Kubernetes examinations changed in 2024
-------------------------------------------

For those who are familiar with or passed the CKA or CKAD tests a few years ago, the test has changed and uses a brand new system to score your submission.

The noticeable changes from 2021:

* The test runs on a Debian virtual machine, and local remote desktop software is running to connect to the remote desktop.
* The local software checks multiple monitors and only allows one monitor.
* You upload your ID before the examination and don't have to show it to the interviewer every time.
* You can't bring your bookmarks.
* Scores are available after around 24 hours of taking the exam.
* You got the k=kubectl alias in the terminal.

Changes for CKA and CKAD questions:

* Exam questions include JSON path.
* Manifest API deprecation included.
* Etcd backup and restore included.

These changes have improved the quality of the examination, and it's now a little more complicated to achieve high scores. However, they are still intermediate-level exams. As long as you prepare, passing the exam is easy.

The biggest problem with the exam is that you have to clean your desktop, and you cannot put non-decorated things on it. It means that there are no books, notes, and files on the desktop, no scanner, and no anime figures :L

"Let's become Kubestronaut" event
---------------------------------


[**Cloud Native Community Japan - Let's become Kubestronaut | CNCF**
*In-person Event - CNCFのk8s認定試験5種制覇してKubestronautになろう！*
*community.cncf.io*](https://community.cncf.io/events/details/cncf-cloud-native-community-japan-presents-cloud-native-community-japan-lets-become-kubestronaut/)

I was delighted to attend the event and speak at the discussion panel, which was my first time attending such an event. I said these exams are easy as long as you prepare for them, and let's connect.

I received my Kubestronaut jacket at the event and was very pleased to wear it. I was giving the speech that I don't know the benefit of becoming a Kubestronaut yet at the discussion panel and hoping I got hired soon. It was such a surprise that a interviewer recognized the Kubestronaut jacket and I had great behalf of skills, that I will be starting my new position as a Rust Engineer at Woven by Toyota next week :)

For those who are wondering if there is a benefit to becoming a Kubestronaut, Yes, it will come.

Kubestronaut Cheat Sheet
------------------------

Pre Setup

* [kubectl Quick Reference](https://kubernetes.io/docs/reference/kubectl/quick-reference/#interacting-with-running-pods)

Shell:


```
export do="--dry-run=client -o yaml"    # k create deploy nginx --image=nginx $do
export now="--force --grace-period 0"   # k delete pod x $now
```
Basic

Base64:


```
echo -n "admin" | base64 -w0
echo -n "YWRtaW4=" | base64 -d
```
Find pod by container id:


```
crictl ps -id <container-id>
crictl pods -id <pod-id>
```
Falco

* [Supported Fields for Conditions and Outputs](https://falco.org/docs/reference/rules/supported-fields/)
* edit /etc/falco/falco\_rules.local.yaml
* cat /opt/course/2/falco.log.dirty | cut -d" " -f 9 > /opt/course/2/falco.log
* The tool cut will split input into fields using space as the delimiter (-d""). We then only select the 9th field using -f 9.

API Server

api-server as static pod: /etc/kubernetes/manifests/kube-apiserver.yaml.

API server:


```
- kube-apiserver
- --authorization-mode=Node,RBAC
- --etcd-servers=https://127.0.0.1:2379
- --enable-admission-plugins=NodeRestriction
# Enable audit logs
- --audit-policy-file=/etc/kubernetes/audit-policy/policy.yaml
- --audit-log-path=/etc/kubernetes/audit-logs/audit.log
- --audit-log-maxsize=7
- --audit-log-maxbackup=2
# expose
- --kubernetes-service-node-port=31000
# CIS benchmark
- --profiling=false
```
Pod Security

* [Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/#baseline)
* [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/)
* [Security Context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)


```
# MODE must be one of `enforce`, `audit`, or `warn`.
# LEVEL must be one of `privileged`, `baseline`, or `restricted`.
pod-security.kubernetes.io/<MODE>: <LEVEL>
```
CIS Benchmark


```
kube-bench run --targets=master
kube-bench run --targets=node
```
Verify Binaries


```
sha512sum /usr/bin/kubelet
cat compare | uniq
```
Open Policy Agent


```
k edit blacklistimages pod-trusted-images
k edit constrainttemplates blacklistimages
```
Secure Kubernetes Dashboard

* <https://github.com/kubernetes/dashboard/tree/master/docs>
* k -n kubernetes-dashboard get pod,svc


```
k -n kubernetes-dashboard edit deploy kubernetes-dashboard
```

```
  template:
    spec:
      containers:
      - args:
        - --namespace=kubernetes-dashboard
        - --authentication-mode=token        # change or delete, "token" is default
        - --auto-generate-certificates       # add
        #- --enable-skip-login=true          # delete or set to false
        #- --enable-insecure-login           # delete
        image: kubernetesui/dashboard:v2.0.3
        imagePullPolicy: Always
        name: kubernetes-dashboard
```
AppArmor

* [AppArmor](https://kubernetes.io/docs/tutorials/security/apparmor/)


	+ apparmor\_parser
	+ aa-status
* [nodeSelector](https://kubernetes.io/docs/tasks/configure-pod-container/assign-pods-nodes/#create-a-pod-that-gets-scheduled-to-your-chosen-node)

gVisor

* [RuntimeClasses](https://kubernetes.io/docs/concepts/containers/runtime-class)


```
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
```
Pod:


```
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: gvisor-test
  name: gvisor-test
  namespace: team-purple
spec:
  nodeName: cluster1-node2 # add
  runtimeClassName: gvisor   # add
  containers:
  - image: nginx:1.19.2
    name: gvisor-test
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
```
ETCD

* [etcdctl](https://etcd.io/docs/v3.5/op-guide/etcdctl/)


```
cat /etc/kubernetes/manifests/kube-apiserver.yaml | grep etcd
ETCDCTL_API=3 etcdctl \
--cert /etc/kubernetes/pki/apiserver-etcd-client.crt \
--key /etc/kubernetes/pki/apiserver-etcd-client.key \
--cacert /etc/kubernetes/pki/etcd/ca.crt get /registry/{type}/{namespace}/{name}
```
Permission escalation


```
k -n restricted get role,rolebinding,clusterrole,clusterrolebinding
k -n restricted get secrets -o yaml

k -n restricted get pod -o yaml | grep -i secret

# via volume
k -n restricted exec pod1-fd5d64b9c-pcx6q -- cat /etc/secret-volume/password

# via env
k -n restricted exec pod2-6494f7699b-4hks5 -- env | grep PASS

# via API
k -n restricted exec -it pod3-748b48594-24s76 -- sh
curl https://kubernetes.default/api/v1/namespaces/restricted/secrets -H "Authorization: Bearer $(cat /run/secrets/kubernetes.io/serviceaccount/token)" -k
```
Network Policies

* [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)


```
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: metadata-deny
  namespace: metadata-access
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 0.0.0.0/0
        except:
        - 192.168.100.21/32
```

```
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: metadata-allow
  namespace: metadata-access
spec:
  podSelector:
    matchLabels:
      role: metadata-accessor
  policyTypes:
  - Egress
  egress:
  - to:
    - ipBlock:
        cidr: 192.168.100.21/32
```
Syscall


```
strace -p <pid>
```
Ingress TLS


```
k -n <namespace> create secret tls tls-secret --key tls.key --cert tls.crt
```
Audit log

* [Audit log](https://kubernetes.io/docs/tasks/debug-application-cluster/audit/)


```
# /etc/kubernetes/audit/policy.yaml
apiVersion: audit.k8s.io/v1
kind: Policy
rules:

# log Secret resources audits, level Metadata
- level: Metadata
  resources:
  - group: ""
    resources: ["secrets"]

# log node related audits, level RequestResponse
- level: RequestResponse
  userGroups: ["system:nodes"]

# for everything else don't log anything
- level: None
```
Other

[Securing a Cluster](https://kubernetes.io/docs/tasks/administer-cluster/securing-a-cluster/):

* [NodeRestriction](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/#noderestriction)
* [Audit logs](https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/#log-backend)
* [CSR](https://kubernetes.io/docs/reference/access-authn-authz/certificate-signing-requests/#normal-user)


	+ [openssl](https://kubernetes.io/docs/tasks/administer-cluster/certificates/#openssl)
* [EncryptionConfiguration](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/#understanding-the-encryption-at-rest-configuration)


	+ kubectl -n one get secrets -o json | kubectl replace -f - recreate secrets
* [ImagePolicyWebhook](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/#imagepolicywebhook)

Notes:

Set client credentials:


```
k config set-credentials 60099@internal.users --client-key=60099.key --client-certificate=60099.crt
k config set-context 60099@internal.users --cluster=kubernetes --user=60099@internal.users
k config get-contexts
k config use-context 60099@internal.users
```
Logs:


```
crictl logs <container-id>
cat /var/log/pods/<pod-id>/<container-name>/0.log
```
Common:


```
watch crictl ps

# We can contact the Apiserver as the Kubelet by using the Kubelet kubeconfig
export KUBECONFIG=/etc/kubernetes/kubelet.conf
```
Docker:


```
# shared PID namespace
docker run --name nginx -d --pid=container:app1 nginx
```
  



