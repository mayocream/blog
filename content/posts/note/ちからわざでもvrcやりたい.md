---
title: "ちからわざでもVRCやりたい"
date: "2024-09-06T20:11:59+09:00"
toc: false
typeface: serif
---
簡単に言うとQuest3単体だけで人権がないですゆ。VRChat公式によるとQuest3がAndroirdプラットフォームで性能が大変残念で、精密な3DアバターのほとんどがVery Poorレベルのモデルで、Quest3対応していません。

公式のImpostorが自動生成の簡易のアバターで、それを自分を生成しないとFallbackのアバターしか表示できない。Quest3単体でもResolutionを調整できないため、目に優しくないってこと。

Quest3もとの性能を発揮したいならPCVRを使うしかない。AirLinkやType-C 2 Type-cのQuest Linkアプリ使うのが公式のおすすめです。そこでSteam LinkもOptionになれますので、LinuxならALVRというOSS Projectもあります。

その中で一番使いやすいのが有料のVirtual DesktopというQuest上のアプリです。Quest3に対応できるAV1のCompression algorithmが使えます。

今度はPCのグラボ性能が全部を決めるので、強いPCがないと終わりだよね。

そこに満足出来ませんので、Cloud PCを使うケースもありました。


[**GCPにクラウドゲーミングPCを用意してQuest2 + VirtualDesktopでVRゲームを遊ぶ - TouTouTree**
*はじめに 誰向け ことわり 事前に用意するもの 手順 GCPでの前準備 VMインスタンスの作成 インスタンスの実行とRDP*
*toutounode.hatenablog.com*](https://toutounode.hatenablog.com/entry/2022/01/17/002033)

でもGCPのGPU Instanceを使うと新しい導入したEasy Anti-Cheatシステムにブロックされました。そこでわかるのはAWSのg4dn.xlargeのInstanceがEACをBypass出来ます。

Shadow PCというアメリカのサービスも使えます。でもVirtual Desktopを直接に使うとLagとLossがひどくて東京で全然VRCやれない（180+ ping）。

で、Networkingを改善するためにWiredguard使った方がわたしのおすすめです（Tailscale）。

Mobile VR Stationを使ってF-droidをインストールして、そしてTailscaleのAndroid版をインストールして、その上でVirtual Desktop StreamerのOptionsの"Allow remote connections"を閉じて：Quest3でTailscaleを使ってWiredguardのTunnelを作って、その上でVirtual Desktopを使って円滑にVRCをPlay出来ます！

  



