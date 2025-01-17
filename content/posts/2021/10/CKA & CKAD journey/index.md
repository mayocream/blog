---
title: "CKA & CKAD journey"
date: "2021-10-11"
typeface: serif
lang: en
---

I achieved [Certified Kubernetes Administrator (CKA)](https://www.cncf.io/certification/cka/) and [Certified Kubernetes Application Developer (CKAD)](https://www.cncf.io/certification/ckad/) last week. 😝

I wanna share my own experience and might provide tips or tricks to help someone who would like to take these exams in recent days (ya, the content of the exam might change as if Kubernetes release new versions).

<div style="display: flex">
	<figure style="max-width: 50%">
        <img src="/images/2021-10-01-01.jpg" />
	</figure>
	<figure style="max-width: 50%">
        <img src="/images/2021-10-01-02.jpg" />
	</figure>
</div>

_Censored for protecting my personal privacy_

It's kinda easy and I took _88_ scores on CKA and _98_ on CKAD, both only spent 1h20m of 2h (showing off but whatever is meaningless).
But damn it, it took me whole the Golden Week for these exams, spending 5 days on CKA and CKAD courses, labs, and simulation exams, another day for exams, the remainder is for Tweet my certificates on Timeline. 

Before preparing for these exams, I was doing DevOps stuff in my team, typing `kubectl` commands every day, and I have read _Kubernetes - The Definitive Guide_ in early 2020.
When I take these courses, it was just recapping the architecture of Kubernetes components, but with flow charts, you can understand easier.

So I shall give advice to guys not just wanting _wasting_ time on them in the end of this article.

## Overall

Take a look at CKA and CKAD exam's objectives:

**CKA general domains and weights**

| Domain                                             | Weight |
| -------------------------------------------------- | ------ |
| Cluster Architecture, Installation & Configuration | 25%    |
| Workloads & Scheduling                             | 15%    |
| Services & Networking                              | 20%    |
| Storage                                            | 10%    |
| Troubleshooting                                    | 30%    |

CKA is for managing the whole Kubernetes cluster, performs installation, configuration, updating, and troubleshooting. 
So as an administrator, you should be able to install Kubernetes cluster on machines, configure cluster network, create client credentials, and so on.

Lots of things to do, but don't worry, you are required only the basic knowledge acting as a CKA.

**CKAD general domains and weights**

| Domain                                              | Weight |
| --------------------------------------------------- | ------ |
| Application Design and Build                        | 20%    |
| Application Deployment                              | 20%    |
| Application Observability and Maintenance           | 15%    |
| Application Environment, Configuration and Security | 25%    |
| Services and Networking                             | 20%    |

Although CKAD is focused on _Application Development_, actually it seems to be DevOps works, like learning how to deploy your application by using Kubernetes [Resource Manifests](https://kubernetes.io/docs/concepts/overview/working-with-objects/kubernetes-objects/). 

Notice that these exams only include skills that meet the minimum requirements for managing or being a Developer of a _Cloud Native_ application.

## Exam itself

It's quite invaluable buying CKA/CKAD exam without discounts, it will cost you \$375 for just one exam.
I purchased CKA and CKAD exam bundle only for $349 in the Black Friday sale.

![](/images/2021-10-01-03.png)

I'm not sure if it's worth taking these exams, but there' no better choice otherwise you wanna take AWS certification or other stuff.
It's much easier than CNAA (Cisco Certified Network Associate).

In the exam, you will be asked about 17 questions, multiple Kubernetes clusters are provided, you can switch between them by using kubectl contexts.

Learn about [Exam FAQ](https://docs.linuxfoundation.org/tc-docs/certification/faq-cka-ckad-cks) for more details.

It's an online proctored exam through PSI and you can take a look at [PSI Online Proctoring Experience](https://psi.wistia.com/medias/5kidxdd0ry) to learn the environment of the exam.

Piece of cake but it's annoying that you are asked to clean your working desk and hide books from the bookshelf. You might wanna see others sharing their exam experience, check this Reddit discuss out [CKAD Exam - Laptop setup query](https://www.reddit.com/r/kubernetes/comments/kl1h4m/ckad_exam_laptop_setup_query/).
I end up hiding my books on the bookshelf covered by a curtain (Ahh).

The Invigilator will "talk" to you in the Chat window, they just sending you message texts and expecting your replies.

![Exam User Interface](/images/2021-10-01-04.png)

Learn more about [Exam User Interface](https://docs.linuxfoundation.org/tc-docs/certification/lf-candidate-handbook/exam-user-interface).

## Tricks and Advice

If you don't know where to start, put your sight on this repo, [walidshaari/Kubernetes-Certified-Administrator](https://github.com/walidshaari/Kubernetes-Certified-Administrator).

Getting yourself familiar with commands in [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/).

Definitely, you _do not_ need to learn JsonPath, It's a piece of sh\*t (even I won't link a reference here).
And _do not_ use confusing alias.
You have **enough** time to get everything working properly.

Useful links for you, [Sher-Chowdhury/Kubernetes-Study-Guide](https://github.com/Sher-Chowdhury/Kubernetes-Study-Guide/blob/master/The-Appendix/02_cka_certification/bookmarks.md).

Sharing you my own Exam Bookmarks, [mayocream/CKA-CKAD-Bookmarks](https://gist.github.com/mayocream/0022fcf2235b5acaedec0333a73b6ea9).
