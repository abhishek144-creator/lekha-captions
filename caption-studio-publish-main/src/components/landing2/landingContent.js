export const rotatingLanguages = [
  'English',
  'Español',
  'Português',
  'Français',
  'Deutsch',
  'العربية',
  '中文',
  '日本語',
  'हिन्दी',
  'Kiswahili',
  'Bahasa',
]

const languageGroups = [
  [
    'हिन्दी · Hindi', 'বাংলা · Bengali', 'ਪੰਜਾਬੀ · Punjabi', 'ગુજરાતી · Gujarati', 'मराठी · Marathi',
    'தமிழ் · Tamil', 'తెలుగు · Telugu', 'ಕನ್ನಡ · Kannada', 'മലയാളം · Malayalam', 'ଓଡ଼ିଆ · Odia', 'অসমীয়া · Assamese',
    'नेपाली · Nepali', 'සිංහල · Sinhala', 'اردو · Urdu', 'کٲشُر · Kashmiri', 'मैथिली · Maithili', 'संस्कृतम् · Sanskrit',
    'कोंकणी · Konkani', 'डोगरी · Dogri', 'سنڌي · Sindhi', 'پښتو · Pashto', 'دری · Dari', 'فارسی · Persian',
    'العربية · Arabic', 'עברית · Hebrew', 'Türkçe · Turkish', 'Kurdî · Kurdish', 'Հայերեն · Armenian', 'ქართული · Georgian',
  ],
  [
    '中文 · Chinese', '日本語 · Japanese', '한국어 · Korean', 'Tiếng Việt · Vietnamese', 'ไทย · Thai', 'ລາວ · Lao',
    'ភាសាខ្មែរ · Khmer', 'မြန်မာ · Burmese', 'Bahasa Indonesia', 'Bahasa Melayu', 'Tagalog · Filipino', 'Cebuano',
    'Javanese', 'Sundanese', 'Монгол · Mongolian', 'Қазақша · Kazakh', 'O‘zbek · Uzbek', 'Кыргызча · Kyrgyz',
    'Тоҷикӣ · Tajik', 'Türkmençe · Turkmen', 'Azərbaycan · Azerbaijani', 'Русский · Russian', 'Українська · Ukrainian', 'Беларуская · Belarusian',
    'Polski · Polish', 'Čeština · Czech', 'Slovenčina · Slovak', 'Magyar · Hungarian', 'Română · Romanian', 'Български · Bulgarian',
  ],
  [
    'English', 'Español · Spanish', 'Português · Portuguese', 'Français · French', 'Deutsch · German', 'Italiano · Italian', 'Nederlands · Dutch',
    'Català · Catalan', 'Galego · Galician', 'Euskara · Basque', 'Gaeilge · Irish', 'Cymraeg · Welsh', 'Gàidhlig · Scottish Gaelic',
    'Íslenska · Icelandic', 'Norsk · Norwegian', 'Svenska · Swedish', 'Dansk · Danish', 'Suomi · Finnish', 'Eesti · Estonian',
    'Latviešu · Latvian', 'Lietuvių · Lithuanian', 'Ελληνικά · Greek', 'Shqip · Albanian', 'Hrvatski · Croatian', 'Српски · Serbian',
    'Bosanski · Bosnian', 'Slovenščina · Slovenian', 'Македонски · Macedonian', 'Malti · Maltese', 'Lëtzebuergesch · Luxembourgish', 'Yiddish · ייִדיש',
  ],
  [
    'Kiswahili · Swahili', 'Afrikaans', 'isiZulu · Zulu', 'isiXhosa · Xhosa', 'Yorùbá · Yoruba', 'Igbo',
    'Hausa', 'አማርኛ · Amharic', 'Soomaali · Somali', 'Oromo', 'Kinyarwanda', 'Kirundi',
    'Lingála · Lingala', 'Luganda', 'Sesotho', 'Setswana', 'Shona', 'Chichewa',
    'Malagasy', 'Wolof', 'Bambara', 'Akan', 'Eʋegbe · Ewe', 'Tigrinya',
    'Tamazight', 'Kreyòl Ayisyen · Haitian Creole', 'Papiamento', 'Māori', 'Gagana Sāmoa · Samoan', 'Lea Faka-Tonga · Tongan',
  ],
]

export const languageBands = [
  [...languageGroups[2], ...languageGroups[0]],
  [...languageGroups[3], ...languageGroups[1]],
]

export const heroStats = [
  ['115+', 'Languages supported'],
  ['100+', 'Caption styles'],
  ['120–180s', 'Shorts & Reels sweet spot'],
]

export const captionDemoPhrases = [
  { lang: 'English', words: ['Your', 'story,', 'in', 'every', 'language'] },
  { lang: 'Español', words: ['Tu', 'historia,', 'en', 'cada', 'idioma'] },
  { lang: 'हिन्दी', words: ['आपकी', 'कहानी,', 'हर', 'भाषा', 'में'] },
  { lang: 'العربية', words: ['قصتك،', 'بكل', 'لغة'] },
]
