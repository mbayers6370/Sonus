export type TravelPhrase = {
  id: string;
  hanzi: string;
  pinyin: string;
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

export const TRAVEL_MODE_SECTIONS: TravelSectionData[] = [
  s(
    'airport-arrival',
    'Airport & Arrival',
    '#186E95',
    'Alert, formal',
    'Documents, Directions, & Understanding Instructions',
    'You just landed in Beijing. You are tired and immigration is moving fast.',
    ['Immigration', 'Baggage', 'Customs', 'Asking for help'],
    [
      "Immigration officers can sound direct. That's normal.",
      'Keep your passport and arrival details ready before the desk.',
      'Use short, clear answers.',
      'Follow airport QR signs for transport and payment.',
      'If needed, show your destination in Chinese on your phone.',
      'Screenshot your hotel address before leaving arrivals.',
    ],
    [
      { id: 'aa-1', hanzi: '我来旅游。', pinyin: 'wǒ lái lǚyóu', literal: 'I come travel', english: "I'm here for tourism." },
      { id: 'aa-2', hanzi: '我来出差。', pinyin: 'wǒ lái chūchāi', literal: 'I come business-trip', english: "I'm here for business." },
      { id: 'aa-3', hanzi: '这是我的护照。', pinyin: 'zhè shì wǒ de hùzhào', english: 'This is my passport.' },
      { id: 'aa-4', hanzi: '我的行李在哪儿？', pinyin: 'wǒ de xíngli zài nǎr', english: 'Where is my baggage?' },
      { id: 'aa-5', hanzi: '我听不懂，请慢一点。', pinyin: 'wǒ tīng bù dǒng, qǐng màn yìdiǎn', english: "I don't understand, please speak slower." },
      { id: 'aa-6', hanzi: '请问，怎么去地铁？', pinyin: 'qǐngwèn, zěnme qù dìtiě', english: 'How do I get to the metro?' },
      { id: 'aa-7', hanzi: '我需要帮助。', pinyin: 'wǒ xūyào bāngzhù', english: 'I need help.' },
      { id: 'aa-8', hanzi: '请问海关在哪儿？', pinyin: 'qǐngwèn hǎiguān zài nǎr', english: 'Where is customs?' },
      { id: 'aa-9', hanzi: '我没有要申报的物品。', pinyin: 'wǒ méiyǒu yào shēnbào de wùpǐn', english: 'I have nothing to declare.' },
      { id: 'aa-10', hanzi: '请再说一遍。', pinyin: 'qǐng zài shuō yí biàn', english: 'Please say it again.' },
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
      'Many drivers expect app-based payment.',
      'Save your destination in Chinese to show drivers fast.',
      'Confirm destination before the ride starts.',
    ],
    [
      { id: 'tr-1', hanzi: '去这个地址。', pinyin: 'qù zhège dìzhǐ', english: 'Go to this address.' },
      { id: 'tr-2', hanzi: '大概多少钱？', pinyin: 'dàgài duōshao qián', english: 'About how much is it?' },
      { id: 'tr-3', hanzi: '请开快一点。', pinyin: 'qǐng kāi kuài yìdiǎn', english: 'Please drive a little faster.' },
      { id: 'tr-4', hanzi: '请在这里停车。', pinyin: 'qǐng zài zhèlǐ tíngchē', english: 'Please stop here.' },
      { id: 'tr-5', hanzi: '最近的地铁站在哪儿？', pinyin: 'zuìjìn de dìtiě zhàn zài nǎr', english: 'Where is the nearest metro station?' },
      { id: 'tr-6', hanzi: '我要去市中心。', pinyin: 'wǒ yào qù shì zhōngxīn', english: 'I need to go to downtown.' },
      { id: 'tr-7', hanzi: '这个方向对吗？', pinyin: 'zhège fāngxiàng duì ma', english: 'Is this the right direction?' },
      { id: 'tr-8', hanzi: '请帮我叫车。', pinyin: 'qǐng bāng wǒ jiào chē', english: 'Please help me call a car.' },
      { id: 'tr-9', hanzi: '我在这里下车。', pinyin: 'wǒ zài zhèlǐ xià chē', english: 'I will get off here.' },
      { id: 'tr-10', hanzi: '请问要换乘吗？', pinyin: 'qǐngwèn yào huànchéng ma', english: 'Do I need to transfer?' },
    ]
  ),
  s(
    'hotel',
    'Hotel & Accommodation',
    '#C2410C',
    'Polite, calm',
    'Check-In & Problem Handling',
    'You are at reception and need to check in quickly with clear details.',
    ['Check-in', 'Room issues', 'Extensions', 'Wi-Fi'],
    [
      'Hotel staff usually prefers short, direct requests.',
      'Have your booking number ready on your phone.',
      'Asking politely first gets faster support.',
    ],
    [
      { id: 'ho-1', hanzi: '我有预订。', pinyin: 'wǒ yǒu yùdìng', english: 'I have a reservation.' },
      { id: 'ho-2', hanzi: '我想办理入住。', pinyin: 'wǒ xiǎng bànlǐ rùzhù', english: "I'd like to check in." },
      { id: 'ho-3', hanzi: '请问早餐几点开始？', pinyin: 'qǐngwèn zǎocān jǐ diǎn kāishǐ', english: 'What time does breakfast start?' },
      { id: 'ho-4', hanzi: '房间没有热水。', pinyin: 'fángjiān méiyǒu rèshuǐ', english: "There's no hot water in the room." },
      { id: 'ho-5', hanzi: '空调坏了。', pinyin: 'kōngtiáo huài le', english: 'The air conditioner is broken.' },
      { id: 'ho-6', hanzi: '可以换房间吗？', pinyin: 'kěyǐ huàn fángjiān ma', english: 'Can I change rooms?' },
      { id: 'ho-7', hanzi: '请给我无线网密码。', pinyin: 'qǐng gěi wǒ wúxiànwǎng mìmǎ', english: 'Please give me the Wi-Fi password.' },
      { id: 'ho-8', hanzi: '我想延住一天。', pinyin: 'wǒ xiǎng yánzhù yì tiān', english: "I'd like to extend one more day." },
      { id: 'ho-9', hanzi: '请帮我叫出租车。', pinyin: 'qǐng bāng wǒ jiào chūzūchē', english: 'Please call a taxi for me.' },
      { id: 'ho-10', hanzi: '我现在退房。', pinyin: 'wǒ xiànzài tuìfáng', english: 'I am checking out now.' },
    ]
  ),
  s(
    'restaurants',
    'Restaurants & Ordering Food',
    '#374151',
    'Social + practical',
    'Ordering, Dietary Needs, & Payment Flow',
    'You sit down at a busy restaurant and need to order quickly and clearly.',
    ['Ordering', 'Recommendations', 'Allergies', 'Splitting bill'],
    [
      'Many restaurants are cashless-first in larger cities.',
      'Ask for recommendations when menus are hard to decode.',
      'Say food restrictions early before ordering.',
    ],
    [
      { id: 're-1', hanzi: '请给我菜单。', pinyin: 'qǐng gěi wǒ càidān', english: 'Please give me the menu.' },
      { id: 're-2', hanzi: '这个辣吗？', pinyin: 'zhège là ma', english: 'Is this spicy?' },
      { id: 're-3', hanzi: '我不吃猪肉。', pinyin: 'wǒ bù chī zhūròu', english: "I don't eat pork." },
      { id: 're-4', hanzi: '我对花生过敏。', pinyin: 'wǒ duì huāshēng guòmǐn', english: "I'm allergic to peanuts." },
      { id: 're-5', hanzi: '请推荐一下。', pinyin: 'qǐng tuījiàn yíxià', english: 'Please recommend something.' },
      { id: 're-6', hanzi: '我们要两份这个。', pinyin: 'wǒmen yào liǎng fèn zhège', english: "We'll take two of this." },
      { id: 're-7', hanzi: '请慢一点上菜。', pinyin: 'qǐng màn yìdiǎn shàngcài', english: 'Please serve the dishes a bit slower.' },
      { id: 're-8', hanzi: '可以打包吗？', pinyin: 'kěyǐ dǎbāo ma', english: 'Can I get this to-go?' },
      { id: 're-9', hanzi: '买单。', pinyin: 'mǎidān', english: 'Check, please.' },
      { id: 're-10', hanzi: '我们可以AA吗？', pinyin: 'wǒmen kěyǐ AA ma', english: 'Can we split the bill?' },
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
      'Many stores ask to scan first, then confirm amount.',
      "If cash is refused, ask where to pay by QR.",
      'Always confirm return policy before paying.',
    ],
    [
      { id: 'sh-1', hanzi: '这个多少钱？', pinyin: 'zhège duōshao qián', english: 'How much is this?' },
      { id: 'sh-2', hanzi: '可以便宜一点吗？', pinyin: 'kěyǐ piányi yìdiǎn ma', english: 'Can it be a little cheaper?' },
      { id: 'sh-3', hanzi: '我用微信支付。', pinyin: 'wǒ yòng Wēixìn zhīfù', english: 'I will pay with WeChat Pay.' },
      { id: 'sh-4', hanzi: '我用支付宝。', pinyin: 'wǒ yòng Zhīfùbǎo', english: 'I will pay with Alipay.' },
      { id: 'sh-5', hanzi: '可以刷卡吗？', pinyin: 'kěyǐ shuākǎ ma', english: 'Can I use a card?' },
      { id: 'sh-6', hanzi: '我没有现金。', pinyin: 'wǒ méiyǒu xiànjīn', english: "I don't have cash." },
      { id: 'sh-7', hanzi: '有折扣吗？', pinyin: 'yǒu zhékòu ma', english: 'Is there a discount?' },
      { id: 'sh-8', hanzi: '可以退货吗？', pinyin: 'kěyǐ tuìhuò ma', english: 'Can I return this?' },
      { id: 'sh-9', hanzi: '我想换一个。', pinyin: 'wǒ xiǎng huàn yí ge', english: 'I want to exchange it.' },
      { id: 'sh-10', hanzi: '请给我发票。', pinyin: 'qǐng gěi wǒ fāpiào', english: 'Please give me a receipt/invoice.' },
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
      'Speak slowly and repeat your key need first.',
      'Show your passport copy on phone if the original is missing.',
      'In urgent moments, short sentences work best.',
    ],
    [
      { id: 'em-1', hanzi: '我需要医生。', pinyin: 'wǒ xūyào yīshēng', english: 'I need a doctor.' },
      { id: 'em-2', hanzi: '请叫救护车。', pinyin: 'qǐng jiào jiùhùchē', english: 'Please call an ambulance.' },
      { id: 'em-3', hanzi: '我不舒服。', pinyin: 'wǒ bù shūfu', english: "I don't feel well." },
      { id: 'em-4', hanzi: '我丢了护照。', pinyin: 'wǒ diū le hùzhào', english: 'I lost my passport.' },
      { id: 'em-5', hanzi: '请帮我报警。', pinyin: 'qǐng bāng wǒ bàojǐng', english: 'Please help me call the police.' },
      { id: 'em-6', hanzi: '最近的医院在哪儿？', pinyin: 'zuìjìn de yīyuàn zài nǎr', english: 'Where is the nearest hospital?' },
      { id: 'em-7', hanzi: '我需要翻译。', pinyin: 'wǒ xūyào fānyì', english: 'I need an interpreter.' },
      { id: 'em-8', hanzi: '请慢慢说。', pinyin: 'qǐng mànmàn shuō', english: 'Please speak slowly.' },
      { id: 'em-9', hanzi: '我在这里。', pinyin: 'wǒ zài zhèlǐ', english: 'I am here.' },
      { id: 'em-10', hanzi: '请帮我联系大使馆。', pinyin: 'qǐng bāng wǒ liánxì dàshǐguǎn', english: 'Please help me contact the embassy.' },
    ]
  ),
  s(
    'small-talk',
    'Everyday Small Talk',
    '#374151',
    'Warm',
    'Friendly Social Connection',
    'You are meeting locals and want to be friendly without sounding textbook.',
    ['Where from?', 'First time?', 'Compliments', 'Exiting politely'],
    [
      'Light compliments are welcome when natural.',
      'Ask simple follow-up questions to keep flow going.',
      'A polite exit line helps avoid awkward endings.',
    ],
    [
      { id: 'st-1', hanzi: '你是哪里人？', pinyin: 'nǐ shì nǎlǐ rén', english: 'Where are you from?' },
      { id: 'st-2', hanzi: '我是第一次来中国。', pinyin: 'wǒ shì dì yī cì lái Zhōngguó', english: 'This is my first time in China.' },
      { id: 'st-3', hanzi: '你的中文很好。', pinyin: 'nǐ de Zhōngwén hěn hǎo', english: 'Your Chinese is very good.' },
      { id: 'st-4', hanzi: '你推荐去哪里玩？', pinyin: 'nǐ tuījiàn qù nǎlǐ wán', english: 'Where do you recommend visiting?' },
      { id: 'st-5', hanzi: '这个地方真不错。', pinyin: 'zhège dìfang zhēn búcuò', english: 'This place is really nice.' },
      { id: 'st-6', hanzi: '很高兴认识你。', pinyin: 'hěn gāoxìng rènshi nǐ', english: 'Nice to meet you.' },
      { id: 'st-7', hanzi: '我先走了。', pinyin: 'wǒ xiān zǒu le', english: 'I will head out first.' },
      { id: 'st-8', hanzi: '下次见！', pinyin: 'xià cì jiàn', english: 'See you next time!' },
      { id: 'st-9', hanzi: '谢谢你今天的帮助。', pinyin: 'xièxie nǐ jīntiān de bāngzhù', english: 'Thanks for your help today.' },
      { id: 'st-10', hanzi: '祝你今天顺利。', pinyin: 'zhù nǐ jīntiān shùnlì', english: 'Hope your day goes smoothly.' },
    ]
  ),
  s(
    'digital',
    'Tech & Digital China',
    '#C2410C',
    'Modern',
    'QR Ecosystem Survival',
    'You need your phone to work for payment, transport, and check-ins.',
    ['Wi-Fi', 'QR scan', 'VPN issues', 'Phone dead'],
    [
      'Keep a power bank; battery anxiety is real in QR-heavy flows.',
      'If scan fails, ask for manual code entry.',
      'Download maps and key addresses offline before transit.',
    ],
    [
      { id: 'di-1', hanzi: '请问有Wi-Fi吗？', pinyin: 'qǐngwèn yǒu Wi-Fi ma', english: 'Do you have Wi-Fi?' },
      { id: 'di-2', hanzi: '密码是多少？', pinyin: 'mìmǎ shì duōshao', english: 'What is the password?' },
      { id: 'di-3', hanzi: '请扫这个二维码。', pinyin: 'qǐng sǎo zhège èrwéimǎ', english: 'Please scan this QR code.' },
      { id: 'di-4', hanzi: '我的手机没电了。', pinyin: 'wǒ de shǒujī méi diàn le', english: 'My phone is out of battery.' },
      { id: 'di-5', hanzi: '可以借我充电器吗？', pinyin: 'kěyǐ jiè wǒ chōngdiànqì ma', english: 'Can I borrow a charger?' },
      { id: 'di-6', hanzi: '这个App怎么用？', pinyin: 'zhège App zěnme yòng', english: 'How do I use this app?' },
      { id: 'di-7', hanzi: '网络有点慢。', pinyin: 'wǎngluò yǒudiǎn màn', english: 'The internet is a bit slow.' },
      { id: 'di-8', hanzi: '我打不开这个页面。', pinyin: 'wǒ dǎ bù kāi zhège yèmiàn', english: "I can't open this page." },
      { id: 'di-9', hanzi: '请再发一次链接。', pinyin: 'qǐng zài fā yí cì liànjiē', english: 'Please send the link again.' },
      { id: 'di-10', hanzi: '我现在可以扫码付款。', pinyin: 'wǒ xiànzài kěyǐ sǎomǎ fùkuǎn', english: 'I can pay by scanning now.' },
    ]
  ),
];

export function getTravelSectionById(sectionId: string) {
  return TRAVEL_MODE_SECTIONS.find((section) => section.id === sectionId);
}
