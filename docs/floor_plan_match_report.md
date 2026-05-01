# Floor plan ↔ CSV cross-reference

Source: `floor_plan_extracted.json` (visual OCR)
Target: `exhibitors.csv` (current supplier DB, 2743 rows with hall code)

## Caveat
Names in the JSON were OCR-read from the venue floor plans. Some are
abbreviations or partial reads; missing matches do **not** prove the
supplier is absent from the DB — they may simply be spelled differently.
Use this to spot **likely** missing entries and translation drift.

## Summary per hall

| Hall | CSV rows | Plan names | Matched | Drift | Likely missing |
|------|---------:|-----------:|--------:|------:|---------------:|
| **E1** | 108 | 76 | 30 | 6 | 38 |
| **E2** | 146 | 113 | 40 | 7 | 62 |
| **E3** | 160 | 107 | 35 | 14 | 51 |
| **E4** | 238 | 80 | 17 | 22 | 39 |
| **E5** | 172 | 86 | 27 | 2 | 50 |
| **E6** | 191 | 93 | 35 | 4 | 50 |
| **E7** | 239 | 93 | 25 | 6 | 49 |
| **N1** | 668 | 89 | 19 | 7 | 51 |
| **W1** | 161 | 88 | 20 | 19 | 43 |
| **W2** | 131 | 98 | 39 | 5 | 50 |
| **W3** | 163 | 73 | 21 | 16 | 33 |
| **W4** | 162 | 77 | 21 | 19 | 35 |
| **W5** | 204 | 74 | 15 | 11 | 48 |

**Total:** 344 matched · 737 unmatched

## Likely missing exhibitors per hall

Names visible on the floor plan with no fuzzy match in the CSV for that hall (similarity < 0.55) **and** not an obvious OCR fragment. If the entry shows a global match, that exhibitor may already exist in the CSV but under a different hall code (data drift between sources).

### E1 — 38 likely missing

- `DAHON GROUP`
- `AZURETA`
- `PUDU`
- `MIO`
- `YT EASING`
- `SANDIN`
- `JHT`
- `GREEN TECH`
- `B.B.KING`  *(maybe = KING CLEAN ELECTRICO.,LTD → currently in E6)*
- `ACE`  *(maybe = HEBEI ACE BEAUTY TECHNOLOGY CO.,LTD → currently in W3)*
- `FASTACE`  *(maybe = FASTACE PRECISION METALS CO.,LTD → currently in E2)*
- `SHIMANO`
- `FOREVER`  *(maybe = FOREVER NEW ENERGY TECHNOLOGY (TIANJIN) CO.,LTD → currently in W1)*
- `BATTLE`
- `KELIN VEHICLE`  *(maybe = CIXI XINDU VEHICLE INDUSTRY CO.,LTD. → currently in E3)*
- `KMC`
- `SML`
- `BICYSTAR GROUP`  *(maybe = HEBEI BICYSTAR GROUP CO., LTD. → currently in N1)*
- `TEWELS`
- `PHOENIX`
- `WUYANG`
- `YONG QI`  *(maybe = ZHEJIANG YONG MEI TECHNOLOGY CO.LTD → currently in N1)*
- `GTMRK`
- `IDEAL CHINA`  *(maybe = WD-40 CHINA COMPANY → currently in W4)*
- `PROLOM`
- `D.MAG`
- `DDLCOL`
- `LEIFA`
- `WANG ZHENG`
- `TJSR`
- `COSY SADDLE`  *(maybe = XINGTAI XIDENGHUI SADDLE CO., LTD → currently in N1)*
- `DYC`
- `JAK`
- `SINOPNE`
- `KSC`
- `ELITE`  *(maybe = XIAMEN ELITE SPORTING:GOODS CO.,LTD → currently in W5)*
- `WEILIAN`
- `EAST SUN`  *(maybe = EVER SUN → currently in N1)*

### E2 — 62 likely missing

- `FOHO`
- `IJB`
- `JIAHONG`
- `ZHENGYI`
- `ENRICO`
- `BFT`
- `SYUN-LP`
- `NOVATEC`
- `SHENGFU SHENGJIE`
- `FENGUAN`
- `NOVERIC`
- `SHENQLU`
- `MEILE`
- `HUAJIU`
- `SUNRUN`
- `STARLIN`
- `NECO`
- `LOGAN`
- `CIONLI`
- `DAYU`
- `BUNGGO TONGLI`  *(maybe = LANXISHI TONGLI ALUMINUM CO.,LTD → currently in E3)*
- `PROWHEEL`
- `MINTAU`
- `MINUI`
- `MAYA`
- `TEC`
- `PSJ`
- `UDING`
- `YENGEZJ`
- `LONGHUI`
- `YBT`
- `MOXLIN`
- `VELO WELLGO`
- `JUSTEK`
- `VICINI`
- `KEMBNL`
- `JOGON`
- `GRILL LION`  *(maybe = JIANGSU HI-TECH GOLDEN LION VEHICLE INDUSTRY CO., LTD → currently in E7)*
- `RXZSC`
- `TENGLIN`
- `JEMENA`
- `JUMENG`
- `MAJUN`
- `WISEMODE`
- `SCUBLA`
- `RUJAN`
- `XINYU SHENG`
- `CHANGFA`
- `MEME`
- `HUBEN`
- `SHIJEN JDER`
- `YUQI`
- `MAIQI`
- `GLI`
- `NAILT`
- `XOIN`
- `TASILYUN`
- `LANBO`
- `XRS`
- `SYNERGRE`
- `FEIDIANG`
- `LINDA`  *(maybe = Tianjin Linda Technology Co., Ltd. → currently in N1)*

### E3 — 51 likely missing

- `HUAMIN`
- `FENGTAI`
- `XAY`
- `CHUNDA`
- `KOUKAI`
- `JIABEI`
- `JIANGUNG`
- `OILONG`
- `HAIWEI`
- `ABIBAKE`
- `JIABBEKE`
- `LEWIS`
- `FEIMA BRAKE`
- `WHEELTOP`
- `GOLDEN SWALLOW`  *(maybe = GOLDEN INTERNATIONAL SPORTING GOODS CO.,LTD → currently in W2)*
- `SUNTOR`
- `SFT`
- `LIANHE`
- `BLF`
- `HUABEI`
- `BIXEI`
- `MAGNESIUM HC`
- `KSC`
- `AIFEITE`
- `CHAOU`
- `DONGFANG JINJIAN`  *(maybe = TIANJIN JINJIAN TRADING CO.,LTD → currently in E4)*
- `PENK INTELLIGENT`  *(maybe = ENGWE INTELLIGENT TECHNOLOGY CO., LIMITED → currently in E6)*
- `YOUSHENG`
- `KANGYUE`
- `LANHANG`
- `YIHUA`
- `WANDA`  *(maybe = WANDA BATTERY INTELLIGENT TECHNOLOGY(KUNSHAN) CO., LTD. → currently in E6)*
- `CHENMING`
- `DLBN`
- `PAFEITE`
- `TUNAISI`
- `STARS-CIRCLE`
- `MIXEER`
- `TEBOKA`
- `MENJON`
- `TAREK`
- `SHENGRUI`  *(maybe = TIANJIN SHENGRUI BICYCLE CO.,LTD → currently in E1)*
- `SHUANGMING`
- `AOYANG GVLI`
- `HENGFENG MOMA`
- `QIYING`
- `VAYNE`
- `XKM`
- `TIANUUN ZHONGUANG`
- `BAISIKE`
- `CEMA SOAQLP`

### E4 — 39 likely missing

- `KENDA`
- `FAGTRON`
- `KYPSO ZONE`
- `XEHE`
- `OL OUOIDA`
- `HSD`
- `TRUDEAT`
- `BRSKY`
- `GUANLING`
- `AK UNO`
- `KAFORD NEDONG`
- `XUAN BING`
- `ACCURA LEGENS`  *(maybe = TIANIIN ACCURA BICYCLE COMPONENTS CO.,LTD → currently in E2)*
- `BLUESKY`  *(maybe = BLUESKY(KUNSHAN)PRINTING CO., LTD. → currently in E2)*
- `LZJ`
- `TWINRIDER FONGNAI`
- `SHUNCHASE`
- `TANDELL GUANGSHEN CHANGSHA`
- `RISINGSUN`
- `PUSHING`
- `FEIXUAN LUYING`
- `JIANLI`
- `GANGJIE TIGGO`
- `ZTLT AOXIN`
- `JINDE HUATAI`
- `HENG LITONG`  *(maybe = BAOJI GUAN HENG TITANIUM INDUSTRY CO., LTD → currently in N1)*
- `SHINE MORE`  *(maybe = NINGBO S.SHINE BICYCLE INDUSTRY CO.,LTD → currently in E3)*
- `YC XULIN`
- `GOOD PUMP OSMAR`  *(maybe = HEBEI GOOD PUMP TECHNOLOGY CO., LTD. → currently in W4)*
- `JIAJI JIAKUELONG`
- `TOOPER`
- `FENG HUANG`  *(maybe = CHENG FENG PRECISION TECHNOLOGY CO.，LTD → currently in E1)*
- `NUO XIN YIN XIN`  *(maybe = JIN XIN YU POWER( SHENZHEN)SUPPLY CO.,LTD → currently in E6)*
- `STRATEGIC SPORTS`  *(maybe = STRATEGIC SPORTS LTD → currently in W4)*
- `XC-TYRE JIDERLO`  *(maybe = MAHAJAN TYRE COMPANY → currently in W1)*
- `YASING KAMI`
- `WISEMODE SUNRUN SCUBLA`
- `HBN DSI`
- `DAFA JINJUAN`

### E5 — 50 likely missing

- `GOOD SAICHUANG`  *(maybe = HANGZHOU GOOD FAITH → currently in E1)*
- `LEHVDSS LP`
- `ZK ENJOY`
- `JETECH HSPC`
- `NABEL RAU ZQ`
- `ANANDA`
- `GENFO`
- `LING GUAN`  *(maybe = BAOJI GUAN HENG TITANIUM INDUSTRY CO., LTD → currently in N1)*
- `AIKEMA TONGSHENG`
- `LISHUI`  *(maybe = HUARUI KINETIC ENERGY TECHNOLOGY (LISHUI) CO., LTD → currently in N1)*
- `IQILI KCQ`
- `SPARD`
- `WUXING`  *(maybe = HUZHOU WUXING HENGYU GLOVE CO.,LTD → currently in N1)*
- `HIGO SHENGYI`
- `LUHONG`
- `GREENWAY`
- `SHUOTONG`
- `ANANDA`
- `MING MEI`  *(maybe = MING SHIJU CO., LTD. → currently in E2)*
- `LZJ`
- `ARO`
- `XOFO`
- `KOUMU`
- `QI SHANG`
- `SZFJ`
- `HENGTAI`
- `VINKA`
- `CZJB`
- `SYR`
- `TUOBANG`
- `YHT`
- `OKAWA`
- `LOFANDI`
- `XIANLE`
- `LANDIAN`
- `BEITIAN`
- `PANA RACER`
- `LDS`
- `HAIYE`
- `JUNLEI`
- `DITAI`
- `TAN SUO`  *(maybe = XING TAI BEI AO SUO JU YOU XIAN GONG SI → currently in E4)*
- `HUIBU`
- `EFAS`
- `ZHANGGUI`
- `DAFENG`  *(maybe = CIXI DAFENG BICYCLE CO.LTD. → currently in E3)*
- `TLC`
- `DOUBEI`
- `YUNG`  *(maybe = YUNG GREAT INTERNATIONAL CO., LTD. DEEPAK INTERNATIONAL LTD → currently in N1)*
- `LBC`

### E6 — 50 likely missing

- `EVERSUN`
- `SHANTAI`
- `RDP`
- `SNKB`
- `GYX`
- `TUV`
- `SBHK`
- `MAIBAOTE`
- `TAO CHEN`  *(maybe = Ming Chen Plastic Products Co., Ltd., Qinghe County → currently in E5)*
- `GOOD OVERFLY`  *(maybe = Tianjin Overfly Vehicle Co., Ltd → currently in W5)*
- `YIFEI WANYU`
- `MXUS`
- `BOE`
- `JOBOBIKE`
- `LIANMEI`
- `LUIA`
- `FEIWEL`
- `LONGYUE`
- `WYT`
- `DOCC`
- `FEISHEN`
- `MICFIRY`
- `TUYU`
- `TFL`
- `SHANSHAN`
- `YOUPENG`
- `MDA`
- `RYDEE`
- `NCYCL`
- `JIAQI`
- `CDILITE`
- `XIN ZHENG`
- `SCUD`
- `DONGXIN`
- `BUYUAN`
- `ZSF`
- `LOOK`
- `YLS`
- `TONG SHANG`  *(maybe = XINGTAI SHANG LEI TECHONLOGY CO.LTD → currently in E5)*
- `WANDAO`
- `YUECHENG`
- `DOSEN`
- `ANNDY`
- `HUA`  *(maybe = SHENZHEN DENGFENG HUA METAL MANUFACTURING CO., LTD → currently in W3)*
- `YHN`
- `TONGFAN CHANGSON`
- `DT BUYE`
- `YUAN YUN`  *(maybe = YUAN YU INTERNATIONAL LTD. → currently in W5)*
- `LEXY`
- `TUOLI`

### E7 — 49 likely missing

- `BST`
- `TAILING`
- `RUGAG`
- `YISU`
- `POWER VM FX`  *(maybe = JINHUA POWER RIM CO.,LTD → currently in E4)*
- `KAIQ MEI`  *(maybe = ZHEJIANG YONG MEI TECHNOLOGY CO.LTD → currently in N1)*
- `VSD`
- `GUANG YUN`  *(maybe = CHANG ZHOU XING YUN POWER TECHNDOGY CO.,LTD → currently in E5)*
- `SGS GEL`
- `LEIDE SEN`
- `LIMA`
- `YITE CYCU`
- `SUER RSLD`
- `IMEGC DIMASHI`
- `MING TU`  *(maybe = MING SHIJU CO., LTD. → currently in E2)*
- `HAOOQ HOUYAN`
- `OFLY AC`
- `AKL`
- `BEVA`
- `COBETTER KAFENG`
- `LANG XIANG`  *(maybe = XING TAI XIANG TIAN BLCYCLE PARTS CO.,LTD → currently in W2)*
- `HEYU`
- `LVXIAO KING`  *(maybe = KING CLEAN ELECTRICO.,LTD → currently in E6)*
- `ZILXEED`
- `YILINWAN`
- `KLYDE HUYTE`
- `YLZAO`
- `SHUILAN`
- `ZIPSEED`
- `OBETTER KAFENG`
- `RKS`
- `ANSBERN`
- `XIAO DU`  *(maybe = DU-HOPE INTERNATIONAL GROUP → currently in W2)*
- `JSL`
- `ZX POWER`  *(maybe = SUZHOU KAIS POWER CO.,LTD. → currently in E6)*
- `DAAO`
- `WEITE`
- `OYF`
- `HUASA`
- `HXY HAIDA`
- `SIMINGE`
- `MAX WHEELS`  *(maybe = UNITED WHEELS 中国 → currently in W1)*
- `ZIHRD`
- `HUTIAN`
- `AQL`
- `HUOYA`
- `EPI`
- `LESHUAI LINQIQI JULALI`
- `KUSA`

### N1 — 51 likely missing

- `SAUNG`
- `RUI SY`
- `SBK`
- `ACX STAR`  *(maybe = RED STAR LOCKS CO.,LTD → currently in W5)*
- `AGAS`
- `BJL`
- `HJC`
- `OYX CYS`
- `ARNGD`
- `TONGEI YR`
- `CWFSD`
- `DXH`
- `HUDA OUYI`
- `ZHY YH`
- `CTBME LUSHU`
- `SIMODE FOUND`
- `HAOLUN`
- `LIATU QIJI`
- `FANGAO KERUKO`
- `YIGRAD`
- `XDH CGS`
- `JINEI LIWEI`
- `TUOMEI JC`
- `XY LEYI`
- `LUOND MM`
- `GOOSYNN HEXATI`
- `NAIBAO AIERSI`
- `JIPANSI`
- `TALANG`
- `INKODOP MANGTAI`
- `LONGLI`
- `HUDINGNUO MACFLT`
- `ATF FMT`
- `TUOYU`
- `RUIAODE`
- `JT RIRUSI`
- `TEWEN`
- `XINOUNUO`
- `VPJ LIANXIN`
- `JIULAN SM`
- `DEYUN`
- `BIASUNUR XJ BMS`
- `JIEJIAN OUTLAY`
- `KP LINER KPS`
- `KAOUYUE`
- `OS DLX FK AZ`
- `OUKUTUS`
- `TRIPEAK`
- `DEC FL SH GUO`  *(maybe = GUO DA (Tianjin) Technology Development Incorporated Company → currently in W2)*
- `CW GHL`
- `JINGRUN`

### W1 — 43 likely missing

- `SAHWELI`
- `YONGTENG SPOKE`  *(maybe = NANTONG HAICHENG SPOKE CO.,LTD → currently in E4)*
- `SPONT FREE`
- `MUSEUM RING`
- `COCOA MURPHY`
- `REPSPIDE`
- `JUNBEN`
- `TOPRIGHT`
- `MMC MO`
- `MOTACHE`
- `SUMC`
- `LBN KOMICAS`
- `TTN BEARING`  *(maybe = ANHUI ANBU BEARING CO., LTD. → currently in N1)*
- `MAGURA`
- `NEW SPEED`  *(maybe = TURNLIFE NEW ENERGY CO.LTD → currently in E5)*
- `GUANGSHI WANME`
- `INSURANCE UVOC MS`
- `JAVA`
- `CST`
- `HOLLAND MECHANICS`
- `S-RIDE SROOO`  *(maybe = RIDE AVENTON INC. → currently in N1)*
- `RUDY NAN HONG`  *(maybe = HEBEI HONG YANG TIRE CO.,LTD → currently in E4)*
- `JN TONGGSHAN`
- `COLMAX SENDIKE`
- `TGO MARLUSH`
- `PMT FUJIE`
- `GATES BELT DRIVE`
- `FUSHENGDA`
- `ZGL S-PARTS`  *(maybe = NINGBO FIVE-CYCLE PARTS CO.,LTD. → currently in E2)*
- `WINNPACE SUNPEED`
- `ROCKBROS`
- `SHIMANO`
- `ABC`
- `HEJIE HUAJIE`
- `HYSINTEC`
- `COMPLEX SENICK`
- `BIYK WTB`
- `HONGYU LICOM ZIDA`
- `ALWAYSRIDING`
- `BORUITE`
- `RIGTOR`
- `BATCH`
- `PARDUS`

### W2 — 50 likely missing

- `JINGE`
- `BOCHUANG`  *(maybe = ZHEJIANG BOCHUANG POWER CO., LTD. → currently in E6)*
- `YIDA`
- `LIDE`
- `YUAN MAO`  *(maybe = YUAN YU INTERNATIONAL LTD. → currently in W5)*
- `YOUNG STAR`  *(maybe = RED STAR LOCKS CO.,LTD → currently in W5)*
- `XTIAN`
- `JINZEKAI`
- `PESU`
- `YAXIN`
- `WAN LUN PULLY XINRONG`  *(maybe = NEW AN LUN LAMP(SHEN ZHEN)CO.,LTD. → currently in W4)*
- `EVERY STAR`  *(maybe = RED STAR LOCKS CO.,LTD → currently in W5)*
- `JINJIA`
- `SELLE PRIMA`
- `HENGCHI GROUP`
- `ZHONG ZHOU`  *(maybe = CHANG ZHOU XING YUN POWER TECHNDOGY CO.,LTD → currently in E5)*
- `LVQIKE`
- `YING TONG`  *(maybe = CHING TONG SHAN ENTERPRISE(HUIZHOU)CO.,LTD → currently in W1)*
- `JIUQI`  *(maybe = HANGZHOU JIUQI CULTURE AND SPORTS CO., LTD → currently in W1)*
- `MEISIDA`
- `RUITUO`
- `YFN`
- `XU TONG`  *(maybe = XU ZHOU DONGHAO IMP.  & EXP. TRADE CO. , LTD. → currently in E5)*
- `XIANG JIN`  *(maybe = TIAN JIN QIAN JUN BICYCLE CO.,LTD → currently in E1)*
- `NANYANG`
- `GRAN MAX`
- `WANYI`
- `YONGWEI`  *(maybe = XI'AN YONGWEI METALWORK CO.,LTD . → currently in E4)*
- `PEERLESS`  *(maybe = PEERLESS AUTOMOTIVE CO..LTD → currently in N1)*
- `YWS`
- `CO-LUCK GHO`
- `DTS`
- `CHENG COU`  *(maybe = CHENG SHIN RUBBER IND.CO.,LTD → currently in W1)*
- `CHUANG QIAN`  *(maybe = SHENZHEN CHUANG XIN WEI BICYCLE CO.,LTD → currently in W1)*
- `JIABAO`
- `WEIYAN`
- `JOY KIE`
- `GOLDEN WHEEL GROUP`  *(maybe = GAOPIN WHEEL RIM CO., LTD → currently in E3)*
- `SHHT`
- `BAIYAN CHEN`  *(maybe = Ming Chen Plastic Products Co., Ltd., Qinghe County → currently in E5)*
- `KSDD`
- `FENG YUN`  *(maybe = FENG RONG PRECISION TECHNOLOGY (DONG GUAN) CO., LTD. → currently in E5)*
- `LIYADE`
- `SHINE WING`  *(maybe = NINGBO S.SHINE BICYCLE INDUSTRY CO.,LTD → currently in E3)*
- `KAICHI`
- `JSSLE`
- `TIANXIANG`
- `SPEED LONG`
- `XINLONG`
- `JINYOUHUI`

### W3 — 33 likely missing

- `JULONG`  *(maybe = NINGBO JULONG ENVIRONMENTAL PROTECTION TECHNOLOGY CO., LTD → currently in E3)*
- `BAIYUAN TONGCHUAN`
- `ROCEXIO`
- `BONGTONG`
- `HUIZHU`
- `FEITIAN`
- `BOH HONG HAOWAN`  *(maybe = HEBEI HONG YANG TIRE CO.,LTD → currently in E4)*
- `DUOLE`
- `DNT`
- `BULUDUN`
- `WANMEI`
- `CHIJIU BAIMEI`
- `ALITONG JINGCHANG`
- `HENGFENG`  *(maybe = CIXI HENGFENG VEHICLE CO.,LTD → currently in E3)*
- `HAILONG SENJIN`
- `VALUE`  *(maybe = AM2R - ABIMOTA - PORTUGAL BIKE VALUE → currently in W1)*
- `TIENIUBIKE`
- `HONG TENG`  *(maybe = HONG FU SPORTS EQUIPMENT CO. LTD → currently in W5)*
- `MAIBANGKE`
- `OUYATE`
- `XIAOTIANHANG`
- `WEIKEDUO`
- `QIHAO`
- `RUIDA`
- `GENBUM SHI CHEN`  *(maybe = XINGTAI SHI SUTI BICYCLE CO.,LTD → currently in N1)*
- `YATONG`
- `EVERSUN`
- `DATOO`
- `SHENZONIK`
- `JUDI FUDA`
- `LIANGZUKAS`
- `GUANGUAJI`
- `TIANBEN`

### W4 — 35 likely missing

- `HAOTU`
- `SHUNDA`
- `ALIDE`
- `GANGZHILU`
- `DAEN`
- `HAUMIN`
- `HEBEI WANHAO ANSHENG`  *(maybe = HEBEI YIERSHENG → currently in E4)*
- `BETO`
- `KAIWEI DETAI`
- `MINGZHU PUMP`  *(maybe = XINGTAILECHI HIGH-PRESSURE PUMP FACTORY → currently in W5)*
- `JIANG KANGJUNG`  *(maybe = JIANG DING TECHNOLOGIES (HUIZHOU) CO.,LTD → currently in N1)*
- `ZHUFENG`
- `CHENDAI HONGCONG`
- `HONOR PUMP`
- `MEIDE`
- `SHENGGUANG JINGYI`
- `LANOVA HONGAN`
- `GASTROHIKEN ANNUO`
- `XINGCHENG`  *(maybe = TIANJIN FURUI XINGCHENG TECHNOLOGY CO., LTD → currently in W1)*
- `MINGDA ZHENGNING`
- `CIGNA`
- `XIFANSI`
- `OSKAR-BEBEHUTI`
- `SENDE LOCKS NEW AN LUN`
- `XIANGBAOO`
- `GOOD OSMAR PUMP`  *(maybe = JURONG GOOD METAL PRODUCTS CO., LTD → currently in E2)*
- `HONGFEI JINLI`
- `XOSS`
- `LIETU`
- `SINO`  *(maybe = LIYANG SINO CABLE ELECTRONICS CO.,LTD → currently in E6)*
- `XINGBAKE`
- `IBSPORT PRO`  *(maybe = PRO MEDIA CO., LTD → currently in E7)*
- `KUBEI AILI`
- `CANO`
- `FERTIS SAIDI`

### W5 — 48 likely missing

- `TWELO`
- `LTW`
- `COSTI`
- `TOWILO`
- `SIDEBAG OURING`
- `YONGXIN`  *(maybe = YONGXIN → currently in E3)*
- `TOP CHAIR`
- `AN SHI LI`  *(maybe = XINGTAI SHI SUTI BICYCLE CO.,LTD → currently in N1)*
- `LU JINLU`
- `JINLA`
- `TANGLOZHEN`
- `HEND ONOJUI`
- `GUANCHOL GREENSKY`
- `GAOLEPU`
- `KUJI`
- `SAILING HONGTU`
- `KAIZE BELL`
- `LIXICHI`
- `EK EKAY`
- `ELITEWHEELS`
- `BEIYINA`
- `BAOLIN`
- `BAATCHENG EOL`
- `XCT YOUSI`
- `SHENGHONG`
- `DAE`
- `YUANGCHANG HUAGAISI`  *(maybe = Hebei Huagaisi Electric Vehicle Technology Co., Ltd. → currently in N1)*
- `ABEAR DAGNDD`
- `BLUEPAI`
- `MAIDONG`
- `HEISHI`
- `SANHESHUN`
- `MAGENE`
- `KINHEIQ POWERFOG`
- `UCC`
- `FACTOR`
- `JEMU SHENFENG`
- `LAITEKABEN`
- `JINGHEN QIXING`
- `PANDA POOJUM`
- `TOSUDO RUNFORCE`
- `FEISHEN`
- `MONTASEN`
- `JINBAY YING BANIY YEX`  *(maybe = MEIPIN（XIAMEN）RUBBER INDUSTRIAL CO.,LTD.  /  YING PAIO ENTERPRISE CO.,LTD.(TAIWAN) → currently in W1)*
- `CONCERT`
- `MINKIN`
- `WINFORCE BAANSA JTM TSB`
- `TEWSN QYN JINGDA`

## Possible name drift per hall

Floor-plan name has a partial match (0.55–0.81) in the same hall, suggesting either an alias, abbreviation, or translation difference.

### E1 — 6

- `QIANJUN BICYCLE` ↔ **TIAN JIN QIAN JUN BICYCLE CO.,LTD** (score 0.75)
- `ASK` ↔ **DSK CO.,LTD** (score 0.67)
- `SHANGHAI TONG FENG` ↔ **SHANGHAI CATHAY I.T. CO., LTD.** (score 0.61)
- `FLYING PIGEON` ↔ **TIANJIN FLYINGPIGEON BICYCLE CO.,LTD.** (score 0.59)
- `ROLLING STONE` ↔ **SHANGHAI ROLLINGSTONE BICYCLE CO.,LTD** (score 0.57)
- `DC PLASTIC` ↔ **TAICANAG DONGCHENG PLASTIC COMPANY** (score 0.56)

### E2 — 7

- `KINESS` ↔ **KINESIS INDUSTRY CO.,LTD.** (score 0.92)
- `TCYCLE` ↔ **CYCLE-BAY INTERNATIONAL CO.,LTD.** (score 0.67)
- `MINGFU` ↔ **MING SHIJU CO., LTD.** (score 0.62)
- `SLH` ↔ **SLHBIKE** (score 0.60)
- `MINGLUN` ↔ **MING SHIJU CO., LTD.** (score 0.59)
- `SING KANG` ↔ **TSLG (KUNSHAN)CO .,LTD** (score 0.57)
- `SHAN YANG` ↔ **ALPHA CYCLING** (score 0.55)

### E3 — 14

- `EVERSITT` ↔ **EVERESTT INTERNATIONAL INDUSTRIES LTD** (score 0.88)
- `HAIHONGXIN` ↔ **YONGXIN** (score 0.71)
- `NINGBO SHENGDA` ↔ **NINGBO SHENGZHOU PLASTIC CO.,LTD.** (score 0.68)
- `JOYSUN BICYCLE` ↔ **NINGBO S.SHINE BICYCLE INDUSTRY CO.,LTD** (score 0.65)
- `JEYA BICYCLE` ↔ **TIANJIN MEGHNA BICYCLE CO., LTD.** (score 0.65)
- `NINGBO JIULONG` ↔ **NINGBO BIKEBEARING CO.，LTD** (score 0.62)
- `XIANGLAI` ↔ **XINGTAIJINTE** (score 0.60)
- `EASYUE` ↔ **GASCYCLE** (score 0.57)
- `JIANGLAI` ↔ **YISAI-XINGTAI** (score 0.57)
- `JIN TE` ↔ **XINGTAIJINTE** (score 0.56)
- `KAIJIN` ↔ **XINGTAIJINTE** (score 0.56)
- `XINLAN` ↔ **XINGTAIJINTE** (score 0.56)
- `TIANBEN` ↔ **TIANIINRABER&PS CO.，LTD** (score 0.55)
- `SHANGUE` ↔ **SHANGHAI HAIWEY INTERNATIONAL CORP.** (score 0.55)

### E4 — 22

- `JINHUA UNISKY` ↔ **JINHUA SAMSON RIMS CO.,LTD.** (score 0.65)
- `RUIKANG` ↔ **KANGDE** (score 0.62)
- `TANYUAN` ↔ **TANNUS CO.,LTD** (score 0.62)
- `KAWEI` ↔ **KAIYU** (score 0.60)
- `YANGZHOU FEIHONG` ↔ **GUANGZHOU FEIXUAN RUBBER CO.,LTD.** (score 0.60)
- `CHANGZHOU FENGYU` ↔ **HANGZHOU UNIBEAR TECHNOLOGY CO.,LTD.** (score 0.60)
- `IKAI HONGYUN` ↔ **KAIYU** (score 0.59)
- `SHUANGE XIANGRUI` ↔ **SHANDONG YIXIN RUBBER  CO.LTD** (score 0.59)
- `HAI CHENG` ↔ **HEBEI YIERSHENG** (score 0.58)
- `OMEGA` ↔ **MG** (score 0.57)
- `HONGYANG` ↔ **HEBEI HONG YANG TIRE CO.,LTD** (score 0.57)
- `SHANGRI` ↔ **SHANGHAI INOAC CORPORATION** (score 0.57)
- `POWER XIEMEI` ↔ **JINHUA POWER RIM CO.,LTD** (score 0.57)
- `JINSONG CHANG YU` ↔ **TIANJIN FASTRON TECHNOLOGY CO., LTD** (score 0.57)
- `PING ZHENG` ↔ **XINGTAI CHAOZHENG TIRE CO,LTD** (score 0.56)
- `JOVIAL DIMA BIKE` ↔ **ZHELIANG DIMA RUBBER CO.,LTD.** (score 0.56)
- `WANDA` ↔ **KANGDE** (score 0.55)
- `HUAN SEN` ↔ **HUNAN SUAO TECHNOLOGY CO.,LTD** (score 0.55)
- `MING YANG` ↔ **HEBEI HONG YANG TIRE CO.,LTD** (score 0.55)
- `ZC-RUBBER` ↔ **ZHELIANG DIMA RUBBER CO.,LTD.** (score 0.55)
- `LIGANG OSHENG` ↔ **NINGBO YUSHENG BRAKE CO.,LTD** (score 0.55)
- `FEIKANG HAIBO` ↔ **JIANGXI HUAYI RUBBER CO., LTD** (score 0.55)

### E5 — 2

- `KCAMER ELECTRIC` ↔ **KCLAMBER ELECTRIC TECHNOLOGY CORP.** (score 0.70)
- `SINC LITHIUM BATTERY` ↔ **JOYCUBE BATTERY CO., LTD.** (score 0.57)

### E6 — 4

- `KKY` ↔ **KKE** (score 0.67)
- `XIETONG` ↔ **hyleton** (score 0.57)
- `HAILONG` ↔ **hyleton** (score 0.57)
- `XIANDONG` ↔ **SHANDONG MTEN CO.LTD** (score 0.57)

### E7 — 6

- `WHEELING EBL` ↔ **WHEEL GIANT INC.** (score 0.61)
- `NAKTO` ↔ **ALTON CO.,LTD** (score 0.60)
- `UNIT MOBILITY` ↔ **WUXI UNITED MOBILITY TECHNOLOGY INC** (score 0.59)
- `XIYI TONG` ↔ **GALAXY STONE** (score 0.57)
- `LVDONG MOTOR` ↔ **EIFI MOTOR CO., LTD.** (score 0.55)
- `NAIDISPORTS` ↔ **KUNSHAN CYCLISPORT CO.,LTD** (score 0.55)

### N1 — 7

- `LIYIDA` ↔ **LI YI DA LTD.** (score 0.86)
- `ALLINBIKE` ↔ **ALLEN.BIKE** (score 0.84)
- `KANGGUAN` ↔ **HONGGUANG** (score 0.71)
- `HEBEI YIHE` ↔ **HEBEI BICYSTAR GROUP CO., LTD.** (score 0.58)
- `ST LING` ↔ **Sing Wa International Industries Ltd.** (score 0.57)
- `ADINA` ↔ **BANANA GROUP LIMITED** (score 0.55)
- `YUANIAN JIONG MOTOR` ↔ **UNION MATERIAL COMPANY LTD.** (score 0.55)

### W1 — 19

- `YUANDONG LANJIAN` ↔ **YUANDONGLANJIAN** (score 0.97)
- `ALLIST` ↔ **ALTALIST CO., LTD.** (score 0.86)
- `AMAZINGZYN` ↔ **AMAZING INDUSTRIES** (score 0.82)
- `SPEED WAYS` ↔ **SPEEDWAYS TYRE LTD** (score 0.75)
- `RALSON DIDONG` ↔ **RALSON (INDIA) LIMITED** (score 0.72)
- `TRINX SPORT` ↔ **CCN SPORT LIMITED** (score 0.70)
- `CHENG SHIN TIRES` ↔ **CHENG SHIN RUBBER IND.CO.,LTD** (score 0.65)
- `FUJIAN CARBON` ↔ **JIANGSU QYH CARBON TECH CO.,LTD** (score 0.61)
- `BANGPUR` ↔ **RANGPUR METAL INDUSTRIES LIMITED** (score 0.60)
- `SANHAI NEW CANGUAN` ↔ **SHENZHEN NEW CANGHAI MACHINERY CO., LTD.** (score 0.58)
- `RHO` ↔ **APRO** (score 0.57)
- `KARASAWA` ↔ **BARLAS GROUP** (score 0.57)
- `MICRO PUNCH` ↔ **MICROSHIFT** (score 0.57)
- `VAN RASEL` ↔ **NOVA RIDE** (score 0.56)
- `CHUANGXINWEI` ↔ **SHENZHEN CHUANG XIN WEI BICYCLE CO.,LTD** (score 0.56)
- `SAITELITE RUSH` ↔ **SATE-LITE(FOSHAN)PLASTICS CO.LTD.** (score 0.56)
- `ZI-RUBBER STREN` ↔ **HARTEX RUBBER PRIVATE LIMITED** (score 0.56)
- `LANDONI` ↔ **YUANDONGLANJIAN** (score 0.55)
- `JIABAO` ↔ **AKIBO CORPORATION** (score 0.55)

### W2 — 5

- `ALLUF ORCE` ↔ **ALUFORCE INT'L CO.,LTD** (score 0.73)
- `DA SHENG` ↔ **DASHENG METAL CO.,LTD** (score 0.67)
- `SHENGDA` ↔ **DASHENG METAL CO.,LTD** (score 0.60)
- `FURUI BICYCLE` ↔ **HEBEI SKYS BICYCLE CO.，LTD.** (score 0.58)
- `RBN` ↔ **ORBISSON,S.R.O** (score 0.55)

### W3 — 16

- `KINGCYCLE CUBE BICYCLE` ↔ **HEBEI CUBE BICYCLE CO.,LTD** (score 0.70)
- `YO BICYCLE` ↔ **YIBAIXIN BICYCLE INDUSTRY CO., LTD.** (score 0.69)
- `HONGTU CYCLE` ↔ **HEBEI HONGTENG BICYCLE CO,LTD** (score 0.65)
- `HEBEI HENGLAI` ↔ **HEBEI ZHENGDA BICYCLE CO.,LTD** (score 0.65)
- `SHUO PAI BEIYAGI BIKE` ↔ **HEBEI BEIYAQI BICYCLE CO.,LTD.** (score 0.62)
- `SIRIS` ↔ **SHILI** (score 0.60)
- `TONGBAO TOYS` ↔ **HEBEI HONGTU BABY TOYS CO.,LTD** (score 0.59)
- `JIANBING HENGLAI` ↔ **PINGXIANG SHENGRUI** (score 0.59)
- `TIEYOU TONG MENG` ↔ **NINGBO TONGMENG BICYLE CO.,LTD** (score 0.58)
- `ROYALBABY CYCLE` ↔ **YIBAIXIN BICYCLE INDUSTRY CO., LTD.** (score 0.58)
- `XINWANG` ↔ **XINGTAI KANGQI** (score 0.57)
- `CHIJIU` ↔ **SHILI** (score 0.55)
- `CAIDER HANDAN HENGWEI` ↔ **HANDAN YIHANG CYCLE CO，.LTD.** (score 0.55)
- `KAISHI` ↔ **SHILI** (score 0.55)
- `SHANGXUE` ↔ **SHANGHAI NASEN CO.,LTD.** (score 0.55)
- `JINBANG MERAIQI` ↔ **PINGXIANG SHENGRUI** (score 0.55)

### W4 — 19

- `XIAOGI SPORTS` ↔ **STRATEGIC SPORTS LTD** (score 0.69)
- `JL VEHICLE` ↔ **CHANGZHOU JCL VEHICLE CO.,LTD.** (score 0.65)
- `ZHUHAI SAFETY BCCN` ↔ **ZHUHAI SAFETY HELMETS MFG CO.,LTD** (score 0.65)
- `GOLDIKEY YIMEN LOCKS` ↔ **WENZHOU YIMIN LOCKS CO.LTD.** (score 0.62)
- `JINKU LOCK` ↔ **WENZHOU JINQIU LOCK CO.,LTD.** (score 0.62)
- `JINGYI` ↔ **B&W (JIAXING) CO., LTD.** (score 0.62)
- `BECOOL YUKON ELECTRON` ↔ **HANYANG (BOLUO) ELECTRONICS LIMITED** (score 0.61)
- `HONGLEXIN` ↔ **hetongceshi** (score 0.60)
- `SHENGHUI ANQI` ↔ **CIXI SHENGHUI BICYCLE CO.,LTD** (score 0.59)
- `ZHUFENG INFLATOR` ↔ **XINGTAI AILI INFLATOR CO., LTD** (score 0.59)
- `TONYON LOCKS` ↔ **WENZHOU YIMIN LOCKS CO.LTD.** (score 0.58)
- `XURI LOCKS` ↔ **XIAMEN KINGUARD LOCKS CO.,LTD** (score 0.58)
- `LEDONG CYCLING OUTDOOR` ↔ **DONGGUAN YAQI OUTDOOR PRODUCTS CO.,LTD** (score 0.58)
- `ENGZHESS BODUN` ↔ **ENCHESS INTERNATIONAL CO., LTD.** (score 0.57)
- `BONE BCHEL` ↔ **BÜCHEL** (score 0.57)
- `DONGYIN JS` ↔ **DONGGUAN YIYANG SPORTS CO.,LTD** (score 0.56)
- `ZHONGLI GROUP` ↔ **hetongceshi** (score 0.56)
- `JINJIAN VEHICLE` ↔ **CHANGZHOU JCL VEHICLE CO.,LTD.** (score 0.56)
- `PNY HELMET` ↔ **SHUNDE SMART HELMET CO., LTD.** (score 0.55)

### W5 — 11

- `FROG SPORTS` ↔ **MONU SPORTS** (score 0.73)
- `DIVANO HONGYI` ↔ **DIVANO TECHNOLOGY CO.,LTD** (score 0.73)
- `NAIJING YONGLU` ↔ **NANJING YONGLU TEXTILE LTD,** (score 0.72)
- `HOLEYUN BICYCLE` ↔ **GALAXY BICYCLE CO.,LTD.** (score 0.69)
- `PHOENIX BICYCLE` ↔ **HEBEI YIHE BICYCLE CO.,LTD** (score 0.67)
- `JETSON MOXTON` ↔ **JETSON TRADING** (score 0.67)
- `DIANS GLASSES BICYCLE` ↔ **GALAXY BICYCLE CO.,LTD.** (score 0.63)
- `OC CYBERIA` ↔ **CYBREI** (score 0.62)
- `JULONG MACHINERY` ↔ **SHUZTUNG MACHINERY (KUNSHAN) CO.,LTD.** (score 0.62)
- `ZHEJIANG STARCAST MEILA` ↔ **EAST MELA** (score 0.56)
- `FOSOJIE` ↔ **COSMOS E-BIKE CO.LTD** (score 0.56)