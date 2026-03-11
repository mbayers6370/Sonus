import { normalizeLanguageId } from '../lib/languageRuntime';

export type TravelPhrase = {
  id: string;
  // Generic fields for multi-language support.
  script?: string;
  pronunciation?: string;
  // Legacy keys kept for backward compatibility with existing data.
  nativeScript?: string;
  transliteration?: string;
  literal?: string;
  english: string;
};

export type TravelSectionData = {
  id: string;
  title: string;
  themeColor: string;
  tone: string;
  focus: string;
  scene: string;
  subclusters: string[];
  culturalNotes: string[];
  phrases: TravelPhrase[];
};

const s = (
  id: string,
  title: string,
  themeColor: string,
  tone: string,
  focus: string,
  scene: string,
  subclusters: string[],
  culturalNotes: string[],
  phrases: TravelPhrase[]
): TravelSectionData => ({ id, title, themeColor, tone, focus, scene, subclusters, culturalNotes, phrases });

export const TRAVEL_MODE_SECTIONS_ZH: TravelSectionData[] = [
  s(
    'airport-arrival',
    'Airport & Arrival',
    '#186E95',
    'Alert, formal',
    'Documents, Directions, & Understanding Instructions',
    'You just landed in Beijing. You are tired and immigration is moving fast.',
    ['Immigration', 'Baggage', 'Customs', 'Asking for help'],
    [
      'Use the Official Taxi Line::In Beijing, taxi pickup is clearly signed and runs through the official queue. Have your destination written in the local script before you get in. The address matters more than the hotel’s English name.',
      'Fix Connectivity Before You Leave the Terminal::If your phone setup is not working yet, solve it inside the airport. SIM purchase and setup can involve real-name registration, and airport services are easier to use before you head into the city.',
      'Do Not Rely on One Payment Method for Your First Hour::Foreign cards can now work through Alipay and WeChat Pay, but that does not mean every part of your arrival will feel seamless. Have a backup ready before you leave the airport.',
      'Late Pudong Arrival Changes Your Options::If you land late in Shanghai, the airport night shuttle buses keep running after 23:00 and continue until 45 minutes after the last flight. That can save you if rail timing no longer works in your favor.',
      'Hotels Handle One Registration Step for You::If you are checking into a hotel, your stay registration is handled there. If you are staying in an apartment or with someone privately, that registration step may become your responsibility within 24 hours.',
      'Do Not Leave Arrivals Until You’ve Solved Your First Weak Point::For most new arrivals, the first real friction is one of three things: connectivity, payment, or transport. Airports like Pudong are already set up around those needs, which is a good clue about what usually goes wrong first.',
      'Shanghai Has a Real Luggage Workaround::If your timing is awkward, Shanghai airport offers baggage storage, including longer storage windows than many travelers expect. That is useful for long layovers, early arrivals, or same-day train connections.',
    ],
    [
      { id: 'aa-1', script: '我来旅游，停留七天。', pronunciation: 'wǒ lái lǚyóu, tíngliú qī tiān', literal: 'I come travel, stay seven days', english: "I'm here for tourism and staying seven days." },
      { id: 'aa-2', script: '这是返程机票和酒店预订单。', pronunciation: 'zhè shì fǎnchéng jīpiào hé jiǔdiàn yùdìngdān', english: 'Here are my return ticket and hotel booking.' },
      { id: 'aa-3', script: '请问外国人通道在哪里？', pronunciation: 'qǐngwèn wàiguórén tōngdào zài nǎlǐ', english: 'Where is the foreign passport lane?' },
      { id: 'aa-4', script: '行李转盘几号？', pronunciation: 'xíngli zhuǎnpán jǐ hào', english: 'Which baggage carousel number is it?' },
      { id: 'aa-5', script: '这件行李不是我的。', pronunciation: 'zhè jiàn xíngli bú shì wǒ de', english: "This bag isn't mine." },
      { id: 'aa-6', script: '我没有需要申报的物品。', pronunciation: 'wǒ méiyǒu xūyào shēnbào de wùpǐn', english: 'I have nothing to declare.' },
      { id: 'aa-7', script: '官方出租车排队点在哪里？', pronunciation: 'guānfāng chūzūchē páiduì diǎn zài nǎlǐ', english: 'Where is the official taxi queue?' },
      { id: 'aa-8', script: '请帮我看一下这个地址。', pronunciation: 'qǐng bāng wǒ kàn yíxià zhège dìzhǐ', english: 'Please check this local-script address for me.' },
      { id: 'aa-9', script: '我的手机网络还没开通。', pronunciation: 'wǒ de shǒujī wǎngluò hái méi kāitōng', english: "My phone data isn't active yet." },
      { id: 'aa-10', script: '夜间大巴还在运行吗？', pronunciation: 'yèjiān dàbā hái zài yùnxíng ma', english: 'Are the night shuttle buses still running?' },
    ]
  ),
  s(
    'transport',
    'Transport & Getting Around',
    '#3E5648',
    'Functional',
    'Locations, Prices, & Confirmations',
    'You leave the airport and need to move quickly through a city you do not know.',
    ['Taxi', 'Metro', 'Ride apps', 'Address clarification'],
    [
      'Use The Local Address::In Beijing, especially, the useful move is having the destination in the local script before the ride starts. Taxi queues are clearly signed, service runs 24/7 from the airport, and drivers often do not speak English. The address does the work.',
      'App Rides Work::In Beijing, DiDi and ShouYue now have English versions that support major international credit cards. In Shanghai, you can also book rides through Alipay, WeChat, or DiDi, and Shanghai has been expanding foreigner-friendly transport support across the system.',
      'One Shanghai QR::If you are making more than one trip in Shanghai, SH MaaS / Suishenxing is a useful setup. It now covers metro, buses, suburban rail, maglev, ferries, taxis, shared bikes, and more, with one transport QR code. It also lets one phone scan in up to two companions. That is the kind of detail that saves time immediately.',
      'Tap-In Beijing::You do not always need to buy a metro ticket or download a local app first. Beijing allows many overseas-issued Visa and Mastercard cards to tap directly at fare gates on most urban rail lines. That is a real convenience if you just need to get moving.',
      'Set Up Trains Early::The China Railway 12306 app has an English path for foreign users with passport registration. That matters because trying to do it under time pressure, while already moving, is exactly how a simple train trip becomes annoying.',
      'Carry Small Bills::Cash is accepted, but for buses and smaller transactions, small change matters. In cities like Shanghai and Beijing, payment signage and foreign-card support are improving, but transport is easiest when you already know whether you are paying by tap, QR, or cash.',
    ],
    [
      { id: 'tr-1', script: '去这个地址，请按导航走。', pronunciation: 'qù zhège dìzhǐ, qǐng àn dǎoháng zǒu', english: 'Go to this address, please follow navigation.' },
      { id: 'tr-2', script: '到了请告诉我。', pronunciation: 'dàole qǐng gàosu wǒ', english: 'Please tell me when we arrive.' },
      { id: 'tr-3', script: '预计多久能到？', pronunciation: 'yùjì duōjiǔ néng dào', english: 'How long will it take to get there?' },
      { id: 'tr-4', script: '现在路上堵吗？', pronunciation: 'xiànzài lùshang dǔ ma', english: 'Is traffic heavy right now?' },
      { id: 'tr-5', script: '最近的地铁入口在哪儿？', pronunciation: 'zuìjìn de dìtiě rùkǒu zài nǎr', english: 'Where is the nearest metro entrance?' },
      { id: 'tr-6', script: '这条线路需要换乘吗？', pronunciation: 'zhè tiáo xiànlù xūyào huànchéng ma', english: 'Do I need a transfer on this route?' },
      { id: 'tr-7', script: '可以刷海外银行卡进站吗？', pronunciation: 'kěyǐ shuā hǎiwài yínhángkǎ jìnzhàn ma', english: 'Can I tap in with an overseas bank card?' },
      { id: 'tr-8', script: '请帮我叫一辆滴滴快车。', pronunciation: 'qǐng bāng wǒ jiào yí liàng dīdī kuàichē', english: 'Please help me call a DiDi express ride.' },
      { id: 'tr-9', script: '我要去高铁站，不是普通火车站。', pronunciation: 'wǒ yào qù gāotiězhàn, bú shì pǔtōng huǒchēzhàn', english: 'I need the high-speed rail station, not the regular train station.' },
      { id: 'tr-10', script: '请在前面路口靠边停。', pronunciation: 'qǐng zài qiánmiàn lùkǒu kàobiān tíng', english: 'Please pull over at the next intersection.' },
    ]
  ),
  s(
    'hotel',
    'Hotel & Accommodation',
    '#3E5648',
    'Polite, calm',
    'Check-In & Problem Handling',
    'You are at reception and need to check in quickly with clear details.',
    ['Check-in', 'Room issues', 'Extensions', 'Wi-Fi'],
    [
      'Hotels Cover Registration::If you are staying in a hotel, the residence registration piece is handled there at reception with your passport or other valid travel document. That is a real simplifier compared with staying privately.',
      'Private Stays Need Paperwork::If you are staying in an apartment, with friends, or anywhere other than a hotel, residence registration must be completed within 24 hours. Beijing and some other cities now offer online self-service options, but only if you remember to use them.',
      'Passport Match Matters::Hotels register foreign guests with passports or travel documents. That means the reservation details need to line up cleanly with the ID you are using at the desk.',
      'Bring Backup Payment::Hotels in key areas are supposed to support a diverse range of payment methods, including mobile, bank cards, and cash. Shanghai and Beijing have both been pushing hard on foreign-card acceptance. Even so, the smart move is to have a backup method ready, rather than discovering a payment mismatch while standing at the reception.',
      'Hotels Can Solve Money Friction::Shanghai payment measures specifically call for foreign-currency exchange support at airports, ports, and hotels. That means hotel zones are not just for sleeping; they are part of the arrival infrastructure.',
      'Fix Admin At The Desk::If anything about payment, address confirmation, or registration is unclear, reception is the easiest place to straighten it out while you still have staff, Wi-Fi, and your booking in front of you. That is especially true on day one, before the city starts asking more from your phone than your phone is ready to give.',
    ],
    [
      { id: 'ho-1', script: '我有预订，名字是这个。', pronunciation: 'wǒ yǒu yùdìng, míngzi shì zhège', english: 'I have a reservation under this name.' },
      { id: 'ho-2', script: '我想用护照办理入住。', pronunciation: 'wǒ xiǎng yòng hùzhào bànlǐ rùzhù', english: "I'd like to check in with my passport." },
      { id: 'ho-3', script: '请帮我确认住宿登记已经完成。', pronunciation: 'qǐng bāng wǒ quèrèn zhùsù dēngjì yǐjīng wánchéng', english: 'Please confirm my accommodation registration is completed.' },
      { id: 'ho-4', script: '我想要安静一点的房间。', pronunciation: 'wǒ xiǎng yào ānjìng yìdiǎn de fángjiān', english: "I'd like a quieter room." },
      { id: 'ho-5', script: '房间的Wi-Fi连不上。', pronunciation: 'fángjiān de Wi-Fi lián bù shàng', english: "The room Wi-Fi won't connect." },
      { id: 'ho-6', script: '可以晚一点退房吗？', pronunciation: 'kěyǐ wǎn yìdiǎn tuìfáng ma', english: 'Is late checkout possible?' },
      { id: 'ho-7', script: '可以帮我叫车去这个地址吗？', pronunciation: 'kěyǐ bāng wǒ jiào chē qù zhège dìzhǐ ma', english: 'Can you call a ride to this address for me?' },
      { id: 'ho-8', script: '我明天需要发票。', pronunciation: 'wǒ míngtiān xūyào fāpiào', english: 'I need an invoice tomorrow.' },
      { id: 'ho-9', script: '房卡刷不开门。', pronunciation: 'fángkǎ shuā bù kāi mén', english: "My key card won't open the door." },
      { id: 'ho-10', script: '账单可以打印英文版吗？', pronunciation: 'zhàngdān kěyǐ dǎyìn yīngwén bǎn ma', english: 'Can you print the bill in English?' },
    ]
  ),
  s(
    'restaurants',
    'Restaurants & Ordering Food',
    '#1F2A37',
    'Social + practical',
    'Ordering, Dietary Needs, & Payment Flow',
    'You sit down at a busy restaurant and need to order quickly and clearly.',
    ['Ordering', 'Recommendations', 'Allergies', 'Splitting bill'],
    [
      'Payment Comes First::In Shanghai and Beijing, mobile payments are deeply integrated into daily life. Restaurants are among the sectors being pushed to better support foreign cards and cash, but the default payment method in bigger cities is still QR and app-based payments.',
      'Cash Is Slower Than You Think::Merchants are required to accept RMB cash, but in practice, many are so used to electronic payment that larger notes can slow things down because change is not always ready. This matters more in restaurants than people expect.',
      'Look For Card Signs::Shanghai has been pushing card-acceptance coverage in dining establishments and displaying signage for foreign bank cards. That means the useful move is not guessing; it is checking the logos first.',
      'One App Solves A Lot::Alipay and WeChat Pay both support English and cover an enormous share of daily spending. In larger cities, that matters just as much at the table as it does in transit.',
      'Delivery Apps Save You::Shanghai guides for Meituan and Ele.me are there for a reason: they help foreigners browse menus, place orders, pay, and track food orders without being blocked by the language barrier. Even if you are eating in person most of the time, knowing that backup exists makes the whole food situation easier.',
      'Settle Payment Early::The system is getting easier: cards, mobile payments, cash services, and signage are all better than before, but the smooth meal is still the one where payment is already settled before the bill appears.',
    ],
    [
      { id: 're-1', script: '我们两位，谢谢。', pronunciation: 'wǒmen liǎng wèi, xièxie', english: 'Table for two, please.' },
      { id: 're-2', script: '我对花生和贝类过敏。', pronunciation: 'wǒ duì huāshēng hé bèilèi guòmǐn', english: "I'm allergic to peanuts and shellfish." },
      { id: 're-3', script: '这个菜有猪肉吗？', pronunciation: 'zhège cài yǒu zhūròu ma', english: 'Does this dish contain pork?' },
      { id: 're-4', script: '可以少辣，不要香菜吗？', pronunciation: 'kěyǐ shǎo là, bú yào xiāngcài ma', english: 'Can it be less spicy, with no cilantro?' },
      { id: 're-5', script: '先来一壶热水。', pronunciation: 'xiān lái yì hú rèshuǐ', english: 'Please bring a pot of hot water first.' },
      { id: 're-6', script: '请推荐一道不辣的本地菜。', pronunciation: 'qǐng tuījiàn yí dào bú là de běndì cài', english: 'Please recommend a local dish that is not spicy.' },
      { id: 're-7', script: '这道菜可以分开装吗？', pronunciation: 'zhè dào cài kěyǐ fēnkāi zhuāng ma', english: 'Can this dish be packed separately?' },
      { id: 're-8', script: '我们想用外卡付款，可以吗？', pronunciation: 'wǒmen xiǎng yòng wàikǎ fùkuǎn, kěyǐ ma', english: 'We want to pay with a foreign card, is that okay?' },
      { id: 're-9', script: '请给我打包，不要一次性餐具。', pronunciation: 'qǐng gěi wǒ dǎbāo, bú yào yícìxìng cānjù', english: 'Please pack this to go, no disposable cutlery.' },
      { id: 're-10', script: '买单，谢谢。', pronunciation: 'mǎidān, xièxie', english: 'Bill, please. Thank you.' },
    ]
  ),
  s(
    'shopping',
    'Shopping & Payments',
    '#3E5648',
    'Transactional',
    'Price Checks, Payment Methods, & Returns',
    'You are shopping and need to negotiate, pay, and confirm return options quickly.',
    ['WeChat Pay', 'Alipay', 'Discounts', 'Returns'],
    [
      'Scan Direction Matters::At checkout, payment can go either direction: sometimes you scan the merchant QR code, and sometimes the cashier scans yours. Knowing that upfront makes the whole payment moment less awkward.',
      'Cash Works, But It Slows Things Down::RMB cash is still valid, but cash is much less common in daily transactions now, and large notes can create change problems. Shopping moves faster when you already know whether you will be paying by QR code, card, or cash.',
      'Logos Decide Card Acceptance::Do not guess on foreign cards. Look for the logo at the counter first. In Shanghai, international cards are accepted when the correct payment-network logos are displayed; if they are not visible, that usually means you need to ask before the item is bagged.',
      'Instant Tax Refund Exists Now::This is one of the real good-to-know-before-shopping details. Shanghai now offers a refund-upon-purchase service, and Beijing has an instant tax refund service at selected department stores and centralized refund points. If you are making a larger purchase, this is worth checking before you pay.',
      'Backup Cash Is Still Smart::If your QR setup fails, Shanghai still supports ATM cash withdrawal and currency exchange through banks, qualified institutions, and self-service kiosks.',
      'Shopping Apps Matter More Than People Expect::For bigger-city shopping, the digital layer is part of the experience. Shanghai useful-app guides point people to Taobao, JD, Pinduoduo, and Dianping because browsing, comparison, discounts, and local reviews often happen there first.',
    ],
    [
      { id: 'sh-1', script: '这个价格含税吗？', pronunciation: 'zhège jiàgé hán shuì ma', english: 'Is this price tax-included?' },
      { id: 'sh-2', script: '可以试穿吗？', pronunciation: 'kěyǐ shìchuān ma', english: 'Can I try this on?' },
      { id: 'sh-3', script: '这里可以办护照退税吗？', pronunciation: 'zhèlǐ kěyǐ bàn hùzhào tuìshuì ma', english: 'Can I process passport tax refund here?' },
      { id: 'sh-4', script: '退税是在这里办，还是去服务台？', pronunciation: 'tuìshuì shì zài zhèlǐ bàn, háishi qù fúwùtái', english: 'Is tax refund done here or at the service counter?' },
      { id: 'sh-5', script: '我想用信用卡，不用扫码。', pronunciation: 'wǒ xiǎng yòng xìnyòngkǎ, bú yòng sǎomǎ', english: 'I want to pay by credit card, not QR scan.' },
      { id: 'sh-6', script: '可以给我纸质小票吗？', pronunciation: 'kěyǐ gěi wǒ zhǐzhì xiǎopiào ma', english: 'Can I get a paper receipt?' },
      { id: 'sh-7', script: '如果尺寸不合适，可以换吗？', pronunciation: 'rúguǒ chǐcùn bù héshì, kěyǐ huàn ma', english: "If the size doesn't fit, can I exchange it?" },
      { id: 'sh-8', script: '我先比较一下，再回来买。', pronunciation: 'wǒ xiān bǐjiào yíxià, zài huílái mǎi', english: "I'll compare first, then come back to buy." },
      { id: 'sh-9', script: '这个二维码是我扫你，还是你扫我？', pronunciation: 'zhège èrwéimǎ shì wǒ sǎo nǐ, háishi nǐ sǎo wǒ', english: 'For this QR code, do I scan you or do you scan me?' },
      { id: 'sh-10', script: '最近的ATM在哪里？', pronunciation: 'zuìjìn de ATM zài nǎlǐ', english: 'Where is the nearest ATM?' },
    ]
  ),
  s(
    'emergency',
    'Emergencies & Health',
    '#186E95',
    'Clear, slow',
    'Medical & Safety-Critical Requests',
    'Something went wrong and you need clear help right now.',
    ['Medical', 'Police', 'Lost passport', 'Directions'],
    [
      'Emergency Help::If something urgent is happening, skip the general help line. In China, the emergency numbers are 110 for police, 119 for fire, 120 for medical emergencies, and 122 for traffic accidents. 12345 is for non-emergency city services.',
      '120 Is The Number That Matters::For medical emergencies, 120 is the real entry point. In Beijing, emergency medical services are available at 120, and almost all hospitals have emergency departments. That is the number worth knowing before you ever need it.',
      'Foreign-Language Care Exists, But Not Everywhere::Beijing explicitly lists international medical institutions with emergency services and other hospitals offering full-process foreign-language support. If you need treatment, going to the right hospital matters more than simply going to the closest one.',
      'Appointments Already Have A Foreigner Path::For non-emergency care in Beijing, the International Service Beijing mini program on WeChat or Alipay connects to the Beijing 114 appointment system and is available in English. That is a useful workaround if you need a clinic visit and do not want to navigate hospital registration cold.',
      'Hospitals Can Take More Payment Types Than You Think::International patients in Beijing can pay with RMB cash, major foreign credit cards, UnionPay debit cards, WeChat Pay, and Alipay. That matters in a hurry, because medical payment failure is exactly the wrong surprise to meet at the counter.',
      'Lost Passport Is A Sequence, Not One Task::If your passport is lost, the process is not go to the embassy and be done. Beijing official flow requires a passport-loss certificate or official note, a replacement passport or travel document, and a valid accommodation registration record for the visa replacement step. Shanghai guidance also treats it as a sequence: report the loss, replace the passport, update accommodation details, then handle permit or visa paperwork.',
    ],
    [
      { id: 'em-1', script: '请马上帮我打120，我胸口很痛。', pronunciation: 'qǐng mǎshàng bāng wǒ dǎ yāo èr líng, wǒ xiōngkǒu hěn tòng', english: 'Please call 120 immediately, I have severe chest pain.' },
      { id: 'em-2', script: '我需要会说英语的医生。', pronunciation: 'wǒ xūyào huì shuō yīngyǔ de yīshēng', english: 'I need an English-speaking doctor.' },
      { id: 'em-3', script: '我对青霉素过敏。', pronunciation: 'wǒ duì qīngméisù guòmǐn', english: "I'm allergic to penicillin." },
      { id: 'em-4', script: '我的护照丢了，需要报警。', pronunciation: 'wǒ de hùzhào diū le, xūyào bàojǐng', english: 'I lost my passport and need to file a police report.' },
      { id: 'em-5', script: '最近的派出所怎么走？', pronunciation: 'zuìjìn de pàichūsuǒ zěnme zǒu', english: 'How do I get to the nearest police station?' },
      { id: 'em-6', script: '这是我的用药清单，请给医生看。', pronunciation: 'zhè shì wǒ de yòngyào qīngdān, qǐng gěi yīshēng kàn', english: 'This is my medication list, please show it to the doctor.' },
      { id: 'em-7', script: '我现在头晕，想去急诊。', pronunciation: 'wǒ xiànzài tóuyūn, xiǎng qù jízhěn', english: "I'm dizzy now and need emergency care." },
      { id: 'em-8', script: '可以帮我联系我的领事馆吗？', pronunciation: 'kěyǐ bāng wǒ liánxì wǒ de lǐngshìguǎn ma', english: 'Can you help me contact my consulate?' },
      { id: 'em-9', script: '我需要翻译服务。', pronunciation: 'wǒ xūyào fānyì fúwù', english: 'I need interpretation support.' },
      { id: 'em-10', script: '我住在这个地址，请写给救护车司机。', pronunciation: 'wǒ zhù zài zhège dìzhǐ, qǐng xiě gěi jiùhùchē sījī', english: 'I stay at this address, please write it for the ambulance driver.' },
    ]
  ),
  s(
    'small-talk',
    'Everyday Small Talk',
    '#1F2A37',
    'Warm',
    'Friendly Social Connection',
    'You are meeting locals and want to be friendly without sounding textbook.',
    ['Where from?', 'First time?', 'Compliments', 'Exiting politely'],
    [
      'Personal Questions Can Arrive Early::Topics that feel private to some foreigners may appear quickly in ordinary conversation.',
      'Friendliness Can Be Low-Key::Helpfulness and steadiness often communicate more than overt enthusiasm.',
      'The Group Sets The Pace::In many settings, the surrounding rhythm matters as much as the individual exchange.',
      'Respect Is Often Subtle::Small shifts in tone or formality can matter more than long explanations.',
      'Practicality Comes First::A lot of everyday conversation starts from function rather than performance.',
    ],
    [
      { id: 'st-1', script: '你好，我第一次来中国。', pronunciation: 'nǐhǎo, wǒ dì yī cì lái Zhōngguó', english: "Hi, it's my first time in China." },
      { id: 'st-2', script: '你的建议很有用，谢谢你。', pronunciation: 'nǐ de jiànyì hěn yǒuyòng, xièxie nǐ', english: 'Your advice is very helpful, thank you.' },
      { id: 'st-3', script: '你觉得这附近有什么值得去的地方？', pronunciation: 'nǐ juéde zhè fùjìn yǒu shénme zhídé qù de dìfang', english: 'What places nearby do you think are worth visiting?' },
      { id: 'st-4', script: '我还在学习，请慢一点说。', pronunciation: 'wǒ hái zài xuéxí, qǐng màn yìdiǎn shuō', english: "I'm still learning, please speak a little slower." },
      { id: 'st-5', script: '这家店是本地人常去的吗？', pronunciation: 'zhè jiā diàn shì běndìrén cháng qù de ma', english: 'Do locals often come to this place?' },
      { id: 'st-6', script: '这个菜怎么吃最地道？', pronunciation: 'zhège cài zěnme chī zuì dìdao', english: 'What is the most authentic way to eat this dish?' },
      { id: 'st-7', script: '我先不打扰你了，谢谢。', pronunciation: 'wǒ xiān bù dǎrǎo nǐ le, xièxie', english: "I won't keep you, thank you." },
      { id: 'st-8', script: '今天跟你聊天很开心。', pronunciation: 'jīntiān gēn nǐ liáotiān hěn kāixīn', english: 'I really enjoyed talking with you today.' },
      { id: 'st-9', script: '可以请你帮我拍一张照片吗？', pronunciation: 'kěyǐ qǐng nǐ bāng wǒ pāi yì zhāng zhàopiàn ma', english: 'Could you help me take a photo?' },
      { id: 'st-10', script: '祝你今天顺顺利利。', pronunciation: 'zhù nǐ jīntiān shùnshùnlìlì', english: 'Hope everything goes smoothly for you today.' },
    ]
  ),
  s(
    'digital',
    'Tech & Digital China',
    '#1F2A37',
    'Modern',
    'QR Ecosystem Survival',
    'You need your phone to work for payment, transport, and check-ins.',
    ['Wi-Fi', 'QR scan', 'VPN issues', 'Phone dead'],
    [
      'Your Phone Is Part Of The Infrastructure::In China, your phone does not just help with the trip; it often is the trip. WeChat Pay and Alipay handle day-to-day payments by QR code, and both support English-language versions.',
      'One App Failure Can Break Three Other Tasks::If your payment app is not working, it can affect transport, food, and shopping simultaneously. That is why getting WeChat Pay or Alipay working early matters more than people realize.',
      'Maps Need To Be Local::Gaode Maps (also called Amap) and Baidu Maps are the tools built for the streets you are standing on. Shanghai guidance calls out Gaode for real-time traffic and, in some cases, even how far the next bus is from the stop.',
      'DiDi Is The Cleanest Ride Backup::If transport goes sideways, DiDi is available in English and has an English help chat for disputes.',
      '12306 Is Worth Setting Up Before You Need It::For train travel, the official booking system is Railway 12306. If a same-day or next-day train becomes part of the plan, having it ready in advance saves a lot of avoidable friction.',
      'Life Gets Easier Once You Know The Support Apps::Meituan and Ele.me cover more than food, and Dianping is useful for reviews, nearby options, and discount vouchers. In larger cities, these are not side tools; they are often the fastest way to solve a local problem without speaking much at all.',
    ],
    [
      { id: 'di-1', script: '可以连一下店里的Wi-Fi吗？', pronunciation: 'kěyǐ lián yíxià diàn lǐ de Wi-Fi ma', english: 'Can I connect to the shop Wi-Fi?' },
      { id: 'di-2', script: '这个二维码是点餐还是付款？', pronunciation: 'zhège èrwéimǎ shì diǎncān háishi fùkuǎn', english: 'Is this QR code for ordering or for payment?' },
      { id: 'di-3', script: '我的支付宝绑定外卡失败了。', pronunciation: 'wǒ de Zhīfùbǎo bǎngdìng wàikǎ shībài le', english: 'My Alipay foreign-card linking failed.' },
      { id: 'di-4', script: '我的微信支付需要验证，怎么处理？', pronunciation: 'wǒ de Wēixìn zhīfù xūyào yànzhèng, zěnme chǔlǐ', english: 'My WeChat Pay needs verification; how do I handle it?' },
      { id: 'di-5', script: '可以用现金或银行卡作备用吗？', pronunciation: 'kěyǐ yòng xiànjīn huò yínhángkǎ zuò bèiyòng ma', english: 'Can I use cash or a bank card as backup?' },
      { id: 'di-6', script: '高德地图显示的入口是这个吗？', pronunciation: 'Gāodé dìtú xiǎnshì de rùkǒu shì zhège ma', english: 'Is this the entrance shown on Amap?' },
      { id: 'di-7', script: '滴滴司机找不到我，我把定位发给你。', pronunciation: 'Dīdī sījī zhǎo bù dào wǒ, wǒ bǎ dìngwèi fā gěi nǐ', english: "The DiDi driver can't find me; I'll send my location." },
      { id: 'di-8', script: '12306一直加载中，有别的购票方式吗？', pronunciation: 'yāo èr sān líng liù yìzhí jiāzài zhōng, yǒu bié de gòupiào fāngshì ma', english: '12306 keeps loading; is there another way to buy a ticket?' },
      { id: 'di-9', script: '手机快没电了，附近有充电宝租借点吗？', pronunciation: 'shǒujī kuài méi diàn le, fùjìn yǒu chōngdiànbǎo zūjiè diǎn ma', english: "My phone is almost dead; is there a nearby power-bank rental spot?" },
      { id: 'di-10', script: '请把链接再发一次，我这边打不开。', pronunciation: 'qǐng bǎ liànjiē zài fā yí cì, wǒ zhèbiān dǎ bù kāi', english: "Please send the link again; I can't open it on my side." },
    ]
  ),
];

export const TRAVEL_MODE_SECTIONS_JA: TravelSectionData[] = [
  s(
    'airport-arrival',
    'Airport & Arrival',
    '#186E95',
    'Alert, formal',
    'Immigration, Arrival Rail, & First Directions',
    'You just landed in Tokyo and need fast, clear phrases for immigration, baggage, and train access.',
    ['Immigration', 'Baggage', 'Customs', 'Asking for help'],
    [
      'Before You Land::Complete your digital arrival forms through Visit Japan Web and save the QR code on your phone: https://services.digital.go.jp/en/visit-japan-web/',
      'This replaces paper forms and speeds things up at immigration.',
      'At Immigration::You will scan your passport and confirm your stay details. A short, clear answer is perfect. Having your hotel name and address saved in Japanese can make things smoother if you are asked.',
      'After Baggage Claim::Many travelers take care of a few practical things before heading into the city. You might: Withdraw yen at a 7-Eleven or Japan Post ATM, pick up a SIM card or pocket Wi-Fi, set up your transit card and if you use an iPhone, you can add a Suica directly to Apple Wallet, so you do not need a physical card.',
      'Getting Into the City::Trains are usually the fastest option. Airport train service typically ends late in the evening, and Narita stops earlier than Haneda, so it is important to check the last departure time if you are arriving late.',
      'Taxis are convenient but can be expensive, especially from Narita.',
      "Luggage Tip::Traveling with large bags? Use Japan's luggage delivery service, called takkyubin (宅急便), to ship your luggage directly to your hotel and travel more comfortably through stations.",
    ],
    [
      { id: 'aa-ja-1', script: '入国審査はどこですか？', pronunciation: 'nyuukoku shinsa wa doko desu ka', english: 'Where is immigration?' },
      { id: 'aa-ja-2', script: 'Visit Japan WebのQRコードがあります。', pronunciation: 'bijitto japan webu no kyuu aaru koodo ga arimasu', english: 'I have the Visit Japan Web QR code.' },
      { id: 'aa-ja-3', script: '滞在先は（ホテル名）です。', pronunciation: 'taizaisaki wa (hoteru mei) desu', english: 'My place of stay is (hotel name).' },
      { id: 'aa-ja-4', script: '申告するものはありません。', pronunciation: 'shinkoku suru mono wa arimasen', english: 'I have nothing to declare.' },
      { id: 'aa-ja-5', script: '荷物が出てきません。', pronunciation: 'nimotsu ga dete kimasen', english: "My luggage isn't coming out." },
      { id: 'aa-ja-6', script: 'この荷物が見つかりません。', pronunciation: 'kono nimotsu ga mitsukarimasen', english: "I can't find this bag." },
      { id: 'aa-ja-7', script: 'ATMはどこですか？', pronunciation: 'eetiiemu wa doko desu ka', english: 'Where is an ATM?' },
      { id: 'aa-ja-8', script: 'SIMカード（またはポケットWi-Fi）の受け取りはどこですか？', pronunciation: 'shimu kaado (mata wa poketto waifai) no uketori wa doko desu ka', english: 'Where do I pick up my SIM (or pocket Wi-Fi)?' },
      { id: 'aa-ja-9', script: '（東京）まで一枚お願いします。', pronunciation: '(toukyou) made ichimai onegaishimasu', english: 'One ticket to (Tokyo), please.' },
      { id: 'aa-ja-10', script: '最終電車は何時ですか？', pronunciation: 'saishuu densha wa nanji desu ka', english: 'What time is the last train?' },
    ]
  ),
  s(
    'transport',
    'Transport & Getting Around',
    '#3E5648',
    'Functional',
    'Stations, Transfers, & Fare Confirmation',
    'You are moving through busy stations and need clear route and transfer language.',
    ['Taxi', 'Train', 'Transfers', 'Address confirmation'],
    [
      'Using IC Cards::You can add a Suica or PASMO card directly to Apple Wallet and tap your phone at the ticket gates, called 改札 (kaisatsu). Tap once when entering and once when exiting.',
      'While Suica and PASMO are most common in Tokyo, other IC cards like ICOCA and TOICA also work, and they are largely interchangeable across regions.',
      'Always keep enough balance on your card. You can recharge at ticket machines or convenience stores, and IC cards can also be used at many shops and convenience stores.',
      'Inside the Station::Show your destination in Japanese to reduce routing mistakes.',
      'If you are unsure about transfers, ask before passing through the ticket gates.',
      'If you get off too early or go too far, do not panic. As long as you are still inside the gates, you can simply board the next train going back in the correct direction. If you exit the gates by mistake, the fare will usually just adjust when you re-enter.',
      'Stations can feel overwhelming at first, but they are highly organized. Take it slow.',
      'If Trains Are Delayed::Google Maps works very well for routing in Japan.',
      'If you are confused, station staff can usually point you to the fastest alternate line.',
      'Taxis::Taxis are clean and reliable, but more expensive than trains, especially for longer distances.',
      'If you prefer app-based booking, the GO taxi app is commonly used in Japan.',
      'Confirm fare estimates early for longer rides.',
    ],
    [
      { id: 'aa-ja-1', script: '入国審査はどこですか？', pronunciation: 'nyuukoku shinsa wa doko desu ka', english: 'Where is immigration?' },
      { id: 'aa-ja-2', script: 'Visit Japan WebのQRコードがあります。', pronunciation: 'bijitto japan webu no kyuu aaru koodo ga arimasu', english: 'I have the Visit Japan Web QR code.' },
      { id: 'aa-ja-3', script: '滞在先は（ホテル名）です。', pronunciation: 'taizaisaki wa (hoteru mei) desu', english: 'My place of stay is (hotel name).' },
      { id: 'aa-ja-4', script: '申告するものはありません。', pronunciation: 'shinkoku suru mono wa arimasen', english: 'I have nothing to declare.' },
      { id: 'aa-ja-5', script: '荷物が出てきません。', pronunciation: 'nimotsu ga dete kimasen', english: "My luggage isn't coming out." },
      { id: 'aa-ja-6', script: 'この荷物が見つかりません。', pronunciation: 'kono nimotsu ga mitsukarimasen', english: "I can't find this bag." },
      { id: 'aa-ja-7', script: 'ATMはどこですか？', pronunciation: 'eetiiemu wa doko desu ka', english: 'Where is an ATM?' },
      { id: 'aa-ja-8', script: 'SIMカード（またはポケットWi-Fi）の受け取りはどこですか？', pronunciation: 'shimu kaado (mata wa poketto waifai) no uketori wa doko desu ka', english: 'Where do I pick up my SIM (or pocket Wi-Fi)?' },
      { id: 'aa-ja-9', script: '（東京）まで一枚お願いします。', pronunciation: '(toukyou) made ichimai onegaishimasu', english: 'One ticket to (Tokyo), please.' },
      { id: 'aa-ja-10', script: '最終電車は何時ですか？', pronunciation: 'saishuu densha wa nanji desu ka', english: 'What time is the last train?' },
    ]
  ),
  s(
    'hotel',
    'Hotel & Accommodation',
    '#3E5648',
    'Polite, calm',
    'Check-In, Room Issues, & Front Desk Requests',
    'You are at reception and need efficient language for check-in and room support.',
    ['Check-in', 'Room issues', 'Wi-Fi', 'Checkout'],
    [
      'Choosing the Right Area (Tokyo Focus)::Location will shape your daily experience more than hotel size.\nShinjuku - Major rail hub, busy, nightlife, strong connections.\nShibuya - Central, shopping, energetic atmosphere.\nGinza - Upscale, refined, quieter at night. \nAsakusa - Traditional feel, slower pace, historic surroundings. \nUeno - Good value, museums, convenient JR access. \nTokyo Station area - Excellent rail access, calmer in the evenings.',
      'Staying near a major train station reduces transfers and late-night stress.',
      'Luggage & Early Arrival::Most hotels will store luggage before check-in and after checkout if you ask.',
      'If you are traveling between cities, you can ship luggage ahead using takkyubin directly from your hotel.',
      'At Check-In::Have your reservation name, passport, and booking confirmation ready.',
      'Hotels in larger cities are accustomed to international guests. Staff are typically polite and efficient. Payment is often processed at check-in rather than checkout.',
      'Japanese addresses are structured differently from Western formats. Showing the full address in Japanese can help taxi drivers or delivery services.',
      'Room Size & Amenities::Tokyo hotel rooms can be smaller than expected. Managing luggage space thoughtfully makes a difference.',
      'Many hotels provide complimentary amenities such as sleepwear, toothbrushes, razors, hairbrushes, and basic toiletries.',
      'Laundry machines are common in business and mid-range hotels. When you check in, confirm whether they use coins or an app-based payment system.',
      'Room Issues & Requests::Describe room issues clearly and specifically.',
      'If you need a room change, ask politely. Availability varies, but staff will usually try to assist.',
      'Common requests include extra towels, luggage storage, late checkout, or Wi-Fi help.',
    ],
    [
      { id: 'ho-ja-1', script: '予約があります。', pronunciation: 'yoyaku ga arimasu', english: 'I have a reservation.' },
      { id: 'ho-ja-2', script: 'パスポートはこちらです。', pronunciation: 'pasupooto wa kochira desu', english: 'Here is my passport.' },
      { id: 'ho-ja-3', script: 'チェックインをお願いします。', pronunciation: 'chekkuin o onegaishimasu', english: "I'd like to check in." },
      { id: 'ho-ja-4', script: '荷物を預かっていただけますか？', pronunciation: 'nimotsu o azukatte itadakemasu ka', english: 'Could you store my luggage?' },
      { id: 'ho-ja-5', script: 'チェックアウトをお願いします。', pronunciation: 'chekkuauto o onegaishimasu', english: "I'd like to check out." },
      { id: 'ho-ja-6', script: 'チェックアウトは何時ですか？', pronunciation: 'chekkuauto wa nanji desu ka', english: 'What time is checkout?' },
      { id: 'ho-ja-7', script: 'Wi-Fiのパスワードを教えてください。', pronunciation: 'waifai no pasuwaado o oshiete kudasai', english: 'Please tell me the Wi-Fi password.' },
      { id: 'ho-ja-8', script: 'ランドリーはありますか？', pronunciation: 'randorii wa arimasu ka', english: 'Is there a laundry machine?' },
      { id: 'ho-ja-9', script: 'お湯が出ません。', pronunciation: 'oyu ga demasen', english: 'There is no hot water.' },
      { id: 'ho-ja-10', script: '部屋を変えていただけますか？', pronunciation: 'heya o kaete itadakemasu ka', english: 'Could I change rooms?' },
    ]
  ),
  s(
    'restaurants',
    'Restaurants & Ordering Food',
    '#1F2A37',
    'Social + practical',
    'Ordering, Restrictions, & Bill Language',
    'You are ordering in a busy restaurant and need clear food and payment phrases.',
    ['Ordering', 'Allergies', 'Recommendations', 'Bill'],
    [
      'Getting Staff Attention::Staff usually will not check in repeatedly. When you are ready, say:',
      'すみません。\n (sumimasen) \nExcuse me.', 'Say it clearly and politely. It is the standard way to get attention.',
      'To ask for the bill:\n お会計お願いします。\n (okaikei onegaishimasu) \nCould we have the bill?',
      'You can also cross your index fingers in an X shape to signal for the check. This gesture is common and understood.',
      "Ordering Simply::When pointing at the menu:\n これお願いします。 \n(kore onegaishimasu) \nI'll have this one.",
      'You do not need complex sentences. Onegaishimasu carries the politeness.',
      'Ticket Machine Restaurants::Some casual shops use a vending machine near the entrance. Purchase your ticket first, then hand it to staff when seated.',
      'If you are unsure, staff will usually guide you.',
      'Paying the Bill::The check is often placed on your table and paid at a register near the exit.',
      'There is no tipping culture in Japan.',
      'Many restaurants accept cards, but some smaller places are cash only. IC cards such as Suica or PASMO may also be accepted, especially in chain locations.',
      'Restrictions & Adjustments::State allergies before ordering.',
      'アレルギーがあります。 \n(arerugii ga arimasu)\n I have an allergy.',
      'Substitutions are less common than in some Western countries, so clarity early helps.',
      'Small Cultural Notes::Water is usually provided automatically. \nPlastic food displays outside many restaurants can help you point and order confidently.',
    ],
    [
      { id: 're-ja-1', script: 'すみません。', pronunciation: 'sumimasen', english: 'Excuse me.' },
      { id: 're-ja-2', script: 'メニューをお願いします。', pronunciation: 'menyuu o onegaishimasu', english: 'Menu, please.' },
      { id: 're-ja-3', script: 'これをお願いします。', pronunciation: 'kore o onegaishimasu', english: 'This one, please.' },
      { id: 're-ja-4', script: 'おすすめは何ですか？', pronunciation: 'osusume wa nan desu ka', english: 'What do you recommend?' },
      { id: 're-ja-5', script: 'これは辛いですか？', pronunciation: 'kore wa karai desu ka', english: 'Is this spicy?' },
      { id: 're-ja-6', script: 'アレルギーがあります。', pronunciation: 'arerugii ga arimasu', english: 'I have an allergy.' },
      { id: 're-ja-7', script: '豚肉は食べられません。', pronunciation: 'butaniku wa taberaremasen', english: "I can't eat pork." },
      { id: 're-ja-8', script: 'お会計お願いします。', pronunciation: 'okaikei onegaishimasu', english: 'Check, please.' },
      { id: 're-ja-9', script: 'カードは使えますか？', pronunciation: 'kaado wa tsukaemasu ka', english: 'Can I use a card?' },
      { id: 're-ja-10', script: '持ち帰りできますか？', pronunciation: 'mochikaeri dekimasu ka', english: 'Can I get this to-go?' },
    ]
  ),
  s(
    'shopping',
    'Shopping & Payments',
    '#3E5648',
    'Transactional',
    'Price Checks, Tax-Free, & Returns',
    'You are shopping and need practical phrases for payment, discounts, and returns.',
    ['Price', 'Discounts', 'Cashless payment', 'Returns'],
    [
      'Tax-Free Shopping::If you want tax-free pricing, you must show your physical passport at the time of purchase. Photos or copies are not accepted.\nSome stores process tax-free directly at the register. Others will direct you to a dedicated tax-free counter after payment.\nTax-free items are often sealed in special duty-free bags. These purchases are considered for export and are meant to remain unopened until you leave Japan. While checks at departure are uncommon, customs officials may inspect them. If sealed goods are opened before departure, you could be required to pay the consumption tax at the airport.\nIf you plan to use something immediately, consider purchasing it normally instead of tax-free.\nKeep receipts with your passport until you depart.',
      'Cash & Payment Methods::Japan is increasingly cashless, but cash is still useful, especially in smaller shops, markets, and older establishments.\n7-Eleven and Japan Post ATMs reliably accept international cards.\nWhen withdrawing money, choose to be charged in Japanese yen (JPY) rather than your home currency to avoid higher conversion fees.\nMost major stores accept credit cards. IC cards such as Suica and PASMO are widely accepted at convenience stores, vending machines, and many retail locations.',
      'Pricing & Receipts::Prices may be listed before tax in smaller print. Confirm the final total at the register if unsure.\nKeep receipts organized if you plan to process tax-free purchases or request returns.\nBargaining is not customary in Japan outside of certain specialty markets.',
      'Returns & Exchanges::Return policies vary by store. Confirm the policy before opening sealed items.\nSome stores may offer exchange only rather than refunds.\nDuty-free purchases may have additional restrictions on returns.',
      'Practical Notes::Bring a reusable bag. Some stores charge for shopping bags.\nIn clothing stores, you may be asked to remove your shoes or use provided shoe covers in fitting rooms.\nConsumption tax is generally 10 percent for most goods, with a reduced rate for certain food items.\nCarrying your passport when planning larger purchases is recommended.',
    ],
      [
        { id: 'sh-ja-1', script: 'これはいくらですか？', pronunciation: 'kore wa ikura desu ka', english: 'How much is this?' },
        { id: 'sh-ja-2', script: '税込みですか？', pronunciation: 'zeikomi desu ka', english: 'Is tax included?' },
        { id: 'sh-ja-3', script: '免税できますか？', pronunciation: 'menzei dekimasu ka', english: 'Is tax-free available?' },
        { id: 'sh-ja-4', script: 'パスポートはこちらです。', pronunciation: 'pasupooto wa kochira desu', english: 'Here is my passport.' },
        { id: 'sh-ja-5', script: 'カードは使えますか？', pronunciation: 'kaado wa tsukaemasu ka', english: 'Can I use a card?' },
        { id: 'sh-ja-6', script: '現金のみですか？', pronunciation: 'genkin nomi desu ka', english: 'Is it cash only?' },
        { id: 'sh-ja-7', script: '袋はいりません。', pronunciation: 'fukuro wa irimasen', english: "I don't need a bag." },
        { id: 'sh-ja-8', script: '試着できますか？', pronunciation: 'shichaku dekimasu ka', english: 'Can I try this on?' },
        { id: 'sh-ja-9', script: 'サイズはありますか？', pronunciation: 'saizu wa arimasu ka', english: 'Do you have this in another size?' },
        { id: 'sh-ja-10', script: 'レシートをください。', pronunciation: 'reshiito o kudasai', english: 'Please give me the receipt.' },
      ]
  ),
  s(
    'emergency',
    'Emergencies & Health',
    '#186E95',
    'Clear, slow',
    'Medical, Police, & Urgent Assistance',
    'You need immediate help and must communicate your core need quickly.',
    ['Medical', 'Police', 'Lost passport', 'Interpreter'],
    [
      'Emergency Numbers In Japan::\nPolice: 110\nAmbulance and Fire: 119', 
      'These numbers are free to call from any phone.\nIf you cannot speak Japanese, say clearly:\n"Eigo onegaishimasu."\n(English, please.)\nMajor cities often have some English support, but not always immediately.',
      'Ambulances & Cost::Calling an ambulance (119) is generally free in Japan.\nHowever, hospital treatment is not free. Payment is required at the hospital unless covered by insurance.\nIf you purchased travel medical insurance, keep your policy number accessible on your phone. You may need to pay first and request reimbursement later.',
      'Hospitals & Clinics::Large urban hospitals may have limited English support. Smaller clinics may not.\nBring:\nPassport\nInsurance details\nMethod of payment\nCredit cards are accepted at many hospitals, but not all.\nFor non-life-threatening issues, searching for "English speaking clinic near me" can help you avoid emergency rooms.',
      'Lost Passport::If your passport is lost or stolen:\n1. Report it to the police and obtain a loss report.\n2. Contact your embassy or consulate.\nPolice boxes called "koban" are common and helpful for reporting lost items.',
      'Pharmacies::Drugstores are common and well-stocked.\nSome medications that are over-the-counter in other countries may require consultation in Japan.\nPharmacists may use translation devices to assist.',
      'Practical Advice Under Stress::Lead with your key need in the first sentence.\nUse short, direct statements.\nRepeat slowly if necessary.\nShow written information on your phone when possible.\nStation staff can often connect you to emergency services quickly if you are in transit areas.',
    ],
    [
      { id: 'em-ja-1', script: '助けてください。', pronunciation: 'tasukete kudasai', english: 'Please help me.' },
      { id: 'em-ja-2', script: '救急車を呼んでください。', pronunciation: 'kyuukyuusha o yonde kudasai', english: 'Please call an ambulance.' },
      { id: 'em-ja-3', script: '警察を呼んでください。', pronunciation: 'keisatsu o yonde kudasai', english: 'Please call the police.' },
      { id: 'em-ja-4', script: '医者が必要です。', pronunciation: 'isha ga hitsuyou desu', english: 'I need a doctor.' },
      { id: 'em-ja-5', script: '気分が悪いです。', pronunciation: 'kibun ga warui desu', english: 'I feel unwell.' },
      { id: 'em-ja-6', script: 'けがをしました。', pronunciation: 'kega o shimashita', english: 'I am injured.' },
      { id: 'em-ja-7', script: 'ここが痛いです。', pronunciation: 'koko ga itai desu', english: 'It hurts here.' },
      { id: 'em-ja-8', script: '英語をお願いします。', pronunciation: 'eigo o onegaishimasu', english: 'English, please.' },
      { id: 'em-ja-9', script: '救急外来はどこですか？', pronunciation: 'kyuukyuu gairai wa doko desu ka', english: 'Where is the emergency room?' },
      { id: 'em-ja-10', script: 'パスポートをなくしました。', pronunciation: 'pasupooto o nakushimashita', english: 'I lost my passport.' },
    ]
  ),
  s(
    'small-talk',
    'Everyday Small Talk',
    '#1F2A37',
    'Warm',
    'Politeness & Conversations with New People',
    'You are meeting locals and want friendly but natural conversation.',
    ['Introductions', 'First time?', 'Recommendations', 'Polite exits'],
    [
      'Politeness Goes Far::You do not need perfect Japanese. You need a calm tone and basic courtesy.\nSimple phrases carry weight:\nありがとうございます\narigatou gozaimasu\nThank you.\nすみません\nsumimasen\nExcuse me / Sorry / Thank you for the trouble.\nUse them often. They smooth almost everything.\nIf you are unsure what to say, keep it short and polite. That is always safe.',
      'Volume & Space::Japan is generally quiet in public. Especially on trains.\nKeep your voice low. Avoid phone calls on trains. Step off to take calls when you can.\nPersonal space is respected. Physical contact is minimal in new social settings.\nA small nod or slight bow when greeting or thanking someone is normal. It does not have to be dramatic.',
      'Conversation Style::Start light.\nWhere are you from.\nIs this your first time in Japan.\nWhat have you enjoyed so far.\nSilence is not awkward here. Pauses are normal.\nIf someone is modest about a compliment, that is cultural, not rejection.',
      'Shrines & Temples::These are active religious spaces, not just photo spots.\nAt shrine entrances you may see a water basin. People lightly rinse their hands before entering. It is symbolic. No need to overthink it.\nSpeak quietly on the grounds.\nDo not step directly in the center of the main path at shrines. Many people walk slightly to the side out of respect.\nPhotos are usually fine outdoors, but avoid photographing worshippers during prayer.',
      'Public Transport Courtesy::On escalators, stand to the left to let people in a hurry pass on the right.\nLine up. Let passengers exit before boarding.\nBackpacks are often worn on the front in crowded trains.\nPriority seating is reserved for elderly passengers, pregnant women, and people with disabilities. Even if empty, stay aware of who boards next.\nIf you miss your stop or get off too early, it is fine. Stay calm. You can reverse direction inside the station without issue unless you exit the ticket gates.',
      'Leaving a Conversation Smoothly::If you want to wrap up politely:\nそろそろ失礼します\nsorosoro shitsurei shimasu\nI should be going.', 
      '今日はありがとうございました\nkyou wa arigatou gozaimashita\nThank you for today.', 
      'Soft exits feel natural here.',
    ],
      [
        { id: 'st-ja-1', script: 'どちらから来ましたか？', pronunciation: 'dochira kara kimashita ka', english: 'Where are you from?' },
        { id: 'st-ja-2', script: '日本は初めてです。', pronunciation: 'nihon wa hajimete desu', english: 'It is my first time in Japan.' },
        { id: 'st-ja-3', script: 'おすすめはありますか？', pronunciation: 'osusume wa arimasu ka', english: 'Do you have a recommendation?' },
        { id: 'st-ja-4', script: 'すみません。', pronunciation: 'sumimasen', english: 'Excuse me.' },
        { id: 'st-ja-5', script: 'ありがとうございます。', pronunciation: 'arigatou gozaimasu', english: 'Thank you.' },
        { id: 'st-ja-6', script: '英語は話せますか？', pronunciation: 'eigo wa hanasemasu ka', english: 'Do you speak English?' },
        { id: 'st-ja-7', script: '写真を撮ってもいいですか？', pronunciation: 'shashin o totte mo ii desu ka', english: 'May I take a photo?' },
        { id: 'st-ja-8', script: 'お名前は何ですか？', pronunciation: 'onamae wa nan desu ka', english: 'What is your name?' },
        { id: 'st-ja-9', script: 'お会いできてうれしいです。', pronunciation: 'oai dekite ureshii desu', english: 'Nice to meet you.' },
        { id: 'st-ja-10', script: 'そろそろ失礼します。', pronunciation: 'sorosoro shitsurei shimasu', english: 'I should be going now.' },
      ]
  ),
  s(
    'digital',
    'Tech & Digital Japan',
    '#1F2A37',
    'Modern',
    'Phone Battery, QR, & App Access',
    'Your phone is central for transit, payments, and reservations across Japan.',
    ['Wi-Fi', 'QR scan', 'Battery', 'Apps'],
    [
      'Keep Your Phone Charged::Your phone handles transit, reservations, maps, and sometimes payment. Carry a power bank if you can. Portable chargers can also be rented at convenience stores and stations through services like ChargeSPOT. You scan a QR code, borrow the battery, and return it at another location.\nSaving screenshots of your hotel address, reservations, and insurance details is useful in case your signal drops.',
      'QR Ordering & Digital Menus::Many restaurants use QR codes at the table. You scan, order from a web menu, and pay at the register near the exit. Smaller shops may still be cash only.\nIf a scan does not work, staff are used to helping.',
      'Maps & Navigation::Google Maps works exceptionally well in Japan. It shows platform numbers, transfer timing, and precise routes. Following the platform number listed in the app removes much of the stress in large stations.\nDownloading maps offline before longer travel days is smart.',
      'Transit & Payment Apps::IC cards such as Suica and PASMO can be added to Apple Wallet and tapped at station gates. You tap in and tap out, and the fare is calculated automatically. These cards also work at convenience stores and many vending machines.\nKeep enough balance on your card to exit the gates. Recharge machines are located near the ticket barriers.',
      'Useful Apps::The GO app is widely used for taxis in major cities.\nTabelog is a popular restaurant review platform. Ratings are stricter than on Google. A score around 3.5 to 3.8 is often very good.\nLINE is the most common messaging app in Japan. It is useful if you exchange contact details with locals or certain businesses.',
    ],
    [
      { id: 'di-ja-1', script: 'Wi-Fiはありますか？', pronunciation: 'waifai wa arimasu ka', english: 'Do you have Wi-Fi?' },
      { id: 'di-ja-2', script: 'パスワードは何ですか？', pronunciation: 'pasuwaado wa nan desu ka', english: 'What is the password?' },
      { id: 'di-ja-4', script: '携帯の充電がありません。', pronunciation: 'keitai no juuden ga arimasen', english: 'My phone battery is dead.' },
      { id: 'di-ja-5', script: '充電器を借りられますか？', pronunciation: 'juudenki o kariraremasu ka', english: 'Can I borrow a charger?' },
      { id: 'di-ja-6', script: 'QRコードで注文できますか？', pronunciation: 'kyuu aaru koodo de chuumon dekimasu ka', english: 'Can I order by QR code?' },
      { id: 'di-ja-7', script: 'Suicaをチャージしたいです。', pronunciation: 'suika o chaaji shitai desu', english: 'I want to top up my Suica.' },
      { id: 'di-ja-8', script: '充電できる場所はありますか？', pronunciation: 'juuden dekiru basho wa arimasu ka', english: 'Is there a place I can charge my phone?' },
      { id: 'di-ja-9', script: '電波が入りません。', pronunciation: 'denpa ga hairimasen', english: 'I have no signal.' },
      { id: 'di-ja-10', script: 'もう一度リンクを送ってください。', pronunciation: 'mou ichido rinku o okutte kudasai', english: 'Please send the link again.' },
      { id: 'di-ja-11', script: 'GOでタクシーを呼びたいです。', pronunciation: 'go de takushii o yobitai desu', english: 'I want to call a taxi with GO.' },
    ]
  ),
];

export function getTravelModeSections(languageId: string | null | undefined) {
  const normalized = normalizeLanguageId(languageId);
  if (normalized === 'ja') return TRAVEL_MODE_SECTIONS_JA;
  return TRAVEL_MODE_SECTIONS_JA;
}

export function getTravelSectionById(sectionId: string, languageId: string | null | undefined = 'ja') {
  return getTravelModeSections(languageId).find((section) => section.id === sectionId);
}

export function getPhraseScriptText(phrase: TravelPhrase): string {
  return phrase.script || phrase.nativeScript || '';
}

export function getPhrasePronunciationText(phrase: TravelPhrase): string {
  return phrase.pronunciation || phrase.transliteration || '';
}
