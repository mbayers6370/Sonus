#!/usr/bin/env node

/**
 * HSK 3.0 Band 1 Word Reorganizer
 *
 * This script reorganizes words from band1.json into thematic units
 * based on semantic analysis of their English definitions and part of speech.
 */

const fs = require('fs');
const path = require('path');

// Unit classification rules
const UNIT_RULES = {
  'b1-pronouns': {
    keywords: ['I', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'mine', 'yours', 'theirs', 'myself', 'yourself', 'himself', 'herself', 'ourselves', 'themselves', 'not', 'no'],
    pos: ['Pron'],
    exact: ['我', '你', '您', '他', '她', '它', '我们', '你们', '他们', '她们', '它们', '自己', '大家', '别人', '人家', '咱们', '不', '没']
  },

  'b1-politeness': {
    keywords: ['hello', 'hi', 'goodbye', 'bye', 'thank', 'please', 'sorry', 'excuse', 'welcome', 'greet', 'polite', 'respect', 'apolog', "you're welcome", 'come in', 'have a seat'],
    exact: ['你好', '您好', '再见', '谢谢', '对不起', '不好意思', '请', '欢迎', '拜拜', '没关系', '不客气', '请进', '请坐']
  },

  'b1-numbers': {
    keywords: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand', 'million', 'number', 'count', 'zero', 'first', 'second', 'third'],
    pos: ['Num'],
    exact: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '零', '百', '千', '万', '亿', '两', '半', '第', '数']
  },

  'b1-time': {
    keywords: ['time', 'hour', 'minute', 'second', 'day', 'week', 'month', 'year', 'today', 'tomorrow', 'yesterday', 'morning', 'afternoon', 'evening', 'night', 'noon', 'midnight', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'date', 'calendar', 'when', 'clock', 'watch', 'moment', 'a while'],
    exact: ['时间', '点', '分', '秒', '天', '星期', '周', '月', '年', '今天', '明天', '昨天', '早上', '上午', '中午', '下午', '晚上', '现在', '以前', '以后', '将来', '过去', '时候', '一会儿', '一下儿']
  },

  'b1-family': {
    keywords: ['father', 'mother', 'parent', 'son', 'daughter', 'brother', 'sister', 'grandfather', 'grandmother', 'grandpa', 'grandma', 'uncle', 'aunt', 'cousin', 'family', 'relative', 'husband', 'wife', 'spouse', 'child', 'kid', 'baby', 'person', 'people', 'friend', 'boyfriend', 'girlfriend', 'man', 'boy', 'girl', 'lady', 'doctor', 'birthday'],
    exact: ['爸爸', '妈妈', '父亲', '母亲', '儿子', '女儿', '哥哥', '弟弟', '姐姐', '妹妹', '爷爷', '奶奶', '外公', '外婆', '家', '家人', '亲戚', '丈夫', '妻子', '孩子', '人', '朋友', '朋友们', '男朋友', '女朋友', '男人', '男孩儿', '女孩儿', '小姐', '医生', '生日', '网友']
  },

  'b1-routine': {
    keywords: ['sleep', 'wake', 'eat', 'drink', 'wash', 'shower', 'bath', 'brush', 'get up', 'go to bed', 'daily', 'routine', 'habit', 'breakfast', 'lunch', 'dinner', 'rest', 'relax', 'work', 'start', 'finish', 'begin', 'end', 'illness', 'sick', 'disease', 'matter', 'thing', 'wind', 'weather', 'to rain', 'fall ill'],
    exact: ['起床', '睡觉', '洗澡', '刷牙', '洗脸', '吃饭', '休息', '工作', '生活', '每天', '早饭', '午饭', '晚饭', '病', '事', '事情', '风', '天气', '下雨', '生病']
  },

  'b1-food': {
    keywords: ['food', 'eat', 'drink', 'rice', 'noodle', 'bread', 'meat', 'fish', 'chicken', 'beef', 'pork', 'vegetable', 'fruit', 'apple', 'banana', 'orange', 'water', 'tea', 'coffee', 'milk', 'juice', 'wine', 'beer', 'restaurant', 'dish', 'meal', 'cook', 'delicious', 'tasty', 'hungry', 'thirsty', 'sweet', 'sour', 'bitter', 'spicy', 'hot', 'cold', 'bun', 'steamed', 'dumpling', 'cup', 'glass', 'bottle', 'ball', 'sport'],
    pos: ['Food'],
    exact: ['饭', '米饭', '面', '面条', '面包', '肉', '鱼', '鸡', '牛肉', '猪肉', '菜', '水果', '苹果', '香蕉', '水', '茶', '咖啡', '牛奶', '饮料', '酒', '啤酒', '饭馆', '餐厅', '好吃', '饿', '渴', '包子', '杯子', '瓶子', '面条儿', '球']
  },

  'b1-shopping': {
    keywords: ['buy', 'sell', 'shop', 'store', 'market', 'supermarket', 'mall', 'price', 'cost', 'money', 'yuan', 'dollar', 'pay', 'purchase', 'cheap', 'expensive', 'free', 'discount', 'sale', 'purse', 'wallet', 'clothes', 'clothing'],
    exact: ['买', '卖', '商店', '市场', '超市', '价格', '钱', '块', '元', '毛', '便宜', '贵', '付', '花', '东西', '钱包', '衣服']
  },

  'b1-locations': {
    keywords: ['place', 'location', 'here', 'there', 'home', 'house', 'room', 'school', 'hospital', 'bank', 'post office', 'library', 'park', 'cinema', 'theater', 'museum', 'hotel', 'restaurant', 'office', 'building', 'floor', 'city', 'town', 'village', 'country', 'street', 'road', 'Beijing', 'China', 'sick person', 'patient', 'upstairs', 'downstairs', 'toilet', 'restroom', 'bathroom', 'doorway', 'entrance', 'crossing', 'intersection', 'on the body'],
    exact: ['地方', '这里', '那里', '家', '房子', '房间', '学校', '医院', '银行', '图书馆', '公园', '电影院', '饭店', '办公室', '楼', '城市', '街', '路', '北京', '中国', '病人', '楼上', '楼下', '洗手间', '门口', '路口', '身上']
  },

  'b1-directions': {
    keywords: ['left', 'right', 'front', 'back', 'up', 'down', 'inside', 'outside', 'above', 'below', 'between', 'near', 'far', 'next to', 'opposite', 'direction', 'north', 'south', 'east', 'west', 'middle', 'center', 'side', 'top', 'bottom'],
    exact: ['左', '右', '前', '后', '上', '下', '里', '外', '边', '旁边', '对面', '中间', '附近', '东', '南', '西', '北']
  },

  'b1-transport': {
    keywords: ['bus', 'taxi', 'car', 'train', 'subway', 'plane', 'airplane', 'bicycle', 'bike', 'ship', 'boat', 'drive', 'ride', 'fly', 'walk', 'station', 'airport', 'transport', 'travel', 'trip', 'journey', 'go', 'come', 'arrive', 'leave', 'depart', 'on the car', 'on the bus'],
    exact: ['车', '汽车', '出租车', '火车', '地铁', '飞机', '自行车', '船', '开', '坐', '走', '跑', '站', '机场', '车上']
  },

  'b1-school': {
    keywords: ['study', 'learn', 'teach', 'teacher', 'student', 'class', 'lesson', 'course', 'school', 'university', 'college', 'exam', 'test', 'homework', 'book', 'read', 'write', 'subject', 'math', 'science', 'history', 'language', 'Chinese', 'English', 'computer', 'television', 'TV', 'film', 'movie', 'map', 'abroad', 'foreign', 'worker', 'schoolbag', 'bookstore', 'textbook', 'text', 'cell phone', 'mobile phone', 'online', 'meeting'],
    exact: ['学', '学习', '教', '老师', '学生', '课', '考试', '作业', '书', '读', '写', '汉语', '中文', '英语', '大学', '电脑', '电视', '电视机', '电影', '地图', '国外', '工人', '书包', '书店', '课文', '课本', '手机', '网上', '开会']
  },

  'b1-questions': {
    keywords: ['what', 'who', 'where', 'when', 'why', 'how', 'which', 'whose', 'whom'],
    pos: ['QPr'], // Question pronoun
    exact: ['什么', '谁', '哪', '哪里', '哪儿', '怎么', '怎么样', '为什么', '多少', '几', '吗', '呢']
  },

  'b1-verbs': {
    keywords: ['do', 'make', 'have', 'get', 'give', 'take', 'put', 'see', 'look', 'watch', 'listen', 'hear', 'speak', 'say', 'tell', 'ask', 'answer', 'know', 'think', 'want', 'like', 'love', 'hate', 'need', 'use', 'open', 'close', 'start', 'stop', 'wait', 'help', 'find', 'lose', 'remember', 'forget', 'often', 'frequently', 'wrong', 'incorrect', 'mistake', 'wear', 'obtain', 'receive', 'move', 'movement', 'action', 'reply', 'return', 'meet', 'turn off', 'turn on', 'stand', 'sit down', 'lie', 'jump', 'run', 'walk', 'laugh', 'cry', 'smile', 'dance', 'sing', 'play', 'swim', 'understand', 'finish', 'begin', 'continue', 'change', 'introduce', 'ask for leave', 'check', 'hope', 'prepare', 'take care', 'suddenly', 'especially', 'explain', 'describe', 'to play', 'catch sight', 'inquire', 'joke'],
    pos: ['V', 'Vi', 'Vt', 'Adv'],
    exact: ['常常', '错', '不对', '穿', '打开', '得到', '动', '动作', '关上', '回答', '回到', '记得', '见面', '站', '坐下', '躺', '跳', '跑', '走路', '笑', '哭', '笑话', '跳舞', '唱歌', '游泳', '懂', '完', '开始', '继续', '变', '介绍', '请假', '检查', '希望', '准备', '照顾', '突然', '特别', '解释', '形容', '玩儿', '看到', '看见', '问', '开玩笑', '忘', '忘记'],
    minConfidence: 0.2 // Lower threshold for better verb capture
  },

  'b1-measure': {
    keywords: ['piece', 'classifier', 'measure word', 'counter'],
    pos: ['M', 'Mw'],
    exact: ['个', '本', '只', '张', '杯', '瓶', '件', '条', '双', '位', '口', '些', '点', '下']
  },

  'b1-opinions': {
    keywords: ['like', 'dislike', 'love', 'hate', 'want', 'need', 'prefer', 'wish', 'hope', 'think', 'feel', 'believe', 'opinion', 'idea', 'view', 'agree', 'disagree', 'happy', 'sad', 'glad', 'sorry', 'angry', 'afraid', 'worried', 'excited', 'interesting', 'boring'],
    exact: ['喜欢', '爱', '想', '要', '觉得', '认为', '希望', '高兴', '难过', '生气', '担心', '有意思', '没意思']
  },

  'b1-ability': {
    keywords: ['can', 'could', 'able', 'ability', 'may', 'might', 'allow', 'permit', 'permission', 'possible', 'impossible'],
    pos: ['Aux'], // Auxiliary verb
    exact: ['能', '会', '可以', '应该', '得', '必须', '可能']
  },

  'b1-comparison': {
    keywords: ['more', 'most', 'less', 'least', 'better', 'worse', 'best', 'worst', 'same', 'different', 'than', 'as', 'compare', 'comparison', 'similar', 'like', 'unlike', 'equal'],
    exact: ['比', '更', '最', '一样', '不同', '相同', '像']
  },

  'b1-listening': {
    keywords: ['listen', 'hear', 'sound', 'audio', 'music', 'song', 'sing', 'loud', 'quiet', 'noise'],
    exact: ['听', '声音', '音乐', '歌', '唱', '吵', '安静']
  },

  'b1-speaking': {
    keywords: ['speak', 'talk', 'say', 'tell', 'call', 'shout', 'whisper', 'pronunciation', 'accent', 'voice', 'conversation', 'chat', 'discuss'],
    exact: ['说', '讲', '告诉', '叫', '谈', '聊', '发音']
  },

  // Catch-all for common adjectives, adverbs, and connectors
  'b1-verbs': {
    keywords: ['very', 'quite', 'big', 'small', 'tall', 'short', 'high', 'low', 'long', 'old', 'new', 'good', 'bad', 'beautiful', 'ugly', 'many', 'few', 'much', 'little', 'from', 'with', 'and', 'or', 'but', 'because', 'so', 'surname', 'on top', 'above'],
    pos: ['Adj', 'Adv', 'Conj', 'Prep'],
    minConfidence: 0.2
  }
};

// Score a word against a unit's rules
function scoreWordForUnit(word, unitRules) {
  let score = 0;
  const simp = word.simp.toLowerCase();
  const en = word.en.toLowerCase();
  const defs = word.defs.join(' ').toLowerCase();
  const fullText = `${en} ${defs}`;

  // Check exact matches (highest priority)
  if (unitRules.exact && unitRules.exact.some(exact => simp === exact.toLowerCase())) {
    return 100;
  }

  // Check part of speech
  if (unitRules.pos && unitRules.pos.some(p => word.pos.includes(p))) {
    score += 30;
  }

  // Check keywords
  if (unitRules.keywords) {
    for (const keyword of unitRules.keywords) {
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
      if (regex.test(fullText)) {
        score += 10;
      }
    }
  }

  return score;
}

// Classify a word into the best unit
function classifyWord(word) {
  let bestUnit = '_unallocated';
  let bestScore = 0;

  for (const [unitId, rules] of Object.entries(UNIT_RULES)) {
    const score = scoreWordForUnit(word, rules);
    const minConfidence = rules.minConfidence || 0;

    if (score > bestScore && score >= minConfidence) {
      bestScore = score;
      bestUnit = unitId;
    }
  }

  return { unitId: bestUnit, confidence: bestScore };
}

// Main function
function reorganizeBand1() {
  const inputPath = path.join(__dirname, '../sonus-react/public/data/zh/band1.json');
  const outputPath = path.join(__dirname, '../sonus-react/public/data/zh/band1-reorganized.json');
  const reportPath = path.join(__dirname, '../reorganization-report.txt');

  console.log('📚 Reading band1.json...');
  const bandData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // Collect all words from all units
  const allWords = [];
  for (const [unitId, unit] of Object.entries(bandData.units)) {
    if (unitId !== '_unallocated') {
      for (const word of unit.words) {
        allWords.push(word);
      }
    }
  }

  console.log(`✅ Found ${allWords.length} words to reorganize`);

  // Create new unit structure
  const newUnits = {
    '_unallocated': {
      targetWords: 0,
      allocatedWords: 0,
      words: []
    }
  };

  // Initialize all units from metadata
  for (const unitId of Object.keys(UNIT_RULES)) {
    newUnits[unitId] = {
      targetWords: 0,
      allocatedWords: 0,
      words: []
    };
  }

  // Classify each word
  const classifications = [];
  for (const word of allWords) {
    const result = classifyWord(word);
    classifications.push({
      word,
      unitId: result.unitId,
      confidence: result.confidence
    });

    newUnits[result.unitId].words.push(word);
    newUnits[result.unitId].allocatedWords++;
  }

  // Sort words within each unit by simplified character
  for (const unit of Object.values(newUnits)) {
    unit.words.sort((a, b) => a.simp.localeCompare(b.simp, 'zh-CN'));
  }

  // Update counts
  const newBandData = {
    ...bandData,
    unallocatedWords: newUnits._unallocated.words.length,
    units: newUnits
  };

  // Write output
  console.log('💾 Writing reorganized data...');
  fs.writeFileSync(outputPath, JSON.stringify(newBandData, null, 2), 'utf8');

  // Generate report
  let report = '# HSK 3.0 Band 1 Reorganization Report\n\n';
  report += `Total words: ${allWords.length}\n\n`;

  for (const [unitId, unit] of Object.entries(newUnits)) {
    if (unit.words.length === 0) continue;

    const metadata = unitId === '_unallocated'
      ? { name: 'Unallocated', hanzi: '未分配' }
      : { name: unitId, hanzi: '' };

    report += `## ${metadata.name} (${metadata.hanzi})\n`;
    report += `Words: ${unit.words.length}\n\n`;

    // Show first 10 words
    const preview = unit.words.slice(0, 10);
    for (const word of preview) {
      const classification = classifications.find(c => c.word.id === word.id);
      report += `  - ${word.simp} (${word.pinyin}) - ${word.en} [confidence: ${classification.confidence}]\n`;
    }
    if (unit.words.length > 10) {
      report += `  ... and ${unit.words.length - 10} more\n`;
    }
    report += '\n';
  }

  fs.writeFileSync(reportPath, report, 'utf8');

  console.log('\n✨ Reorganization complete!');
  console.log(`📄 New file: ${outputPath}`);
  console.log(`📊 Report: ${reportPath}`);
  console.log('\n📋 Summary:');

  for (const [unitId, unit] of Object.entries(newUnits)) {
    if (unit.words.length > 0) {
      console.log(`  ${unitId}: ${unit.words.length} words`);
    }
  }
}

// Run the script
reorganizeBand1();
