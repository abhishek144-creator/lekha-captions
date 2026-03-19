export function detectScript(text) {
  if (!text || text.trim().length === 0) return 'latin';

  const codePoints = [...text].map(char => char.codePointAt(0));

  const scriptCounts = {
    devanagari: 0,
    tamil: 0,
    telugu: 0,
    kannada: 0,
    malayalam: 0,
    gujarati: 0,
    bengali: 0,
    punjabi: 0,
    odia: 0,
    arabic: 0,
    chinese: 0,
    japanese: 0,
    korean: 0,
    thai: 0,
    vietnamese: 0,
    latin: 0
  };

  codePoints.forEach(code => {
    if (code >= 0x0900 && code <= 0x097F) scriptCounts.devanagari++;
    else if (code >= 0x0980 && code <= 0x09FF) scriptCounts.bengali++;
    else if (code >= 0x0A00 && code <= 0x0A7F) scriptCounts.punjabi++;
    else if (code >= 0x0A80 && code <= 0x0AFF) scriptCounts.gujarati++;
    else if (code >= 0x0B00 && code <= 0x0B7F) scriptCounts.odia++;
    else if (code >= 0x0B80 && code <= 0x0BFF) scriptCounts.tamil++;
    else if (code >= 0x0C00 && code <= 0x0C7F) scriptCounts.telugu++;
    else if (code >= 0x0C80 && code <= 0x0CFF) scriptCounts.kannada++;
    else if (code >= 0x0D00 && code <= 0x0D7F) scriptCounts.malayalam++;
    else if (code >= 0x0600 && code <= 0x06FF) scriptCounts.arabic++;
    else if (code >= 0x4E00 && code <= 0x9FFF) scriptCounts.chinese++;
    else if (code >= 0x3040 && code <= 0x309F) scriptCounts.japanese++;
    else if (code >= 0x30A0 && code <= 0x30FF) scriptCounts.japanese++;
    else if (code >= 0xAC00 && code <= 0xD7AF) scriptCounts.korean++;
    else if (code >= 0x0E00 && code <= 0x0E7F) scriptCounts.thai++;
    else if ((code >= 0x0041 && code <= 0x007A) || (code >= 0x0061 && code <= 0x007A)) scriptCounts.latin++;
  });

  let maxCount = 0;
  let dominantScript = 'latin';

  Object.entries(scriptCounts).forEach(([script, count]) => {
    if (count > maxCount) {
      maxCount = count;
      dominantScript = script;
    }
  });

  return dominantScript;
}

export const scriptFontMap = {
  devanagari: [
    { name: 'Noto Sans', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Mukta', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Hind', weights: [300, 400, 500, 600, 700] },
    { name: 'Poppins', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Yantramanav', weights: [300, 400, 500, 700, 900] },
    { name: 'Khand', weights: [300, 400, 500, 600, 700] },
    { name: 'Rajdhani', weights: [300, 400, 500, 600, 700] },
    { name: 'Teko', weights: [300, 400, 500, 600, 700] },
    { name: 'Kalam', weights: [300, 400, 700] },
    { name: 'Karma', weights: [300, 400, 500, 600, 700] },
    { name: 'Rozha One', weights: [400] },
    { name: 'Vesper Libre', weights: [400, 500, 700, 900] },
    { name: 'Amita', weights: [400, 700] },
    { name: 'Shrikhand', weights: [400] },
    { name: 'Halant', weights: [300, 400, 500, 600, 700] },
    { name: 'Kurale', weights: [400] },
    { name: 'Arya', weights: [400, 700] },
    { name: 'Inknut Antiqua', weights: [300, 400, 500, 600, 700, 800, 900] },
    { name: 'Eczar', weights: [400, 500, 600, 700, 800] },
    { name: 'Sahitya', weights: [400, 700] },
    { name: 'Rhodium Libre', weights: [400] },
    { name: 'Sumana', weights: [400, 700] },
    { name: 'Martel', weights: [200, 300, 400, 600, 700, 800, 900] },
    { name: 'Sura', weights: [400, 700] },
    { name: 'Asar', weights: [400] }
  ],
  bengali: [
    { name: 'Noto Sans Bengali', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Hind Siliguri', weights: [300, 400, 500, 600, 700] },
    { name: 'Tiro Bangla', weights: [400] },
    { name: 'Anek Bangla', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Noto Serif Bengali', weights: [400, 500, 600, 700] },
    { name: 'Mina', weights: [400, 700] },
    { name: 'Baloo Da 2', weights: [400, 500, 600, 700, 800] },
    { name: 'Galore', weights: [400] },
    { name: 'Atma', weights: [300, 400, 500, 600, 700] },
    { name: 'Aladin', weights: [400] },
    { name: 'Macondo', weights: [400] },
    { name: 'Amethysta', weights: [400] },
    { name: 'Englebert', weights: [400] },
    { name: 'Ruge Boogie', weights: [400] },
    { name: 'Buda', weights: [300] },
    { name: 'Griffy', weights: [400] },
    { name: 'Fontdiner Swanky', weights: [400] },
    { name: 'Delius', weights: [400] },
    { name: 'Galindo', weights: [400] },
    { name: 'Irish Grover', weights: [400] },
    { name: 'Keania One', weights: [400] },
    { name: 'Spirax', weights: [400] },
    { name: 'Vampiro One', weights: [400] },
    { name: 'Flavors', weights: [400] },
    { name: 'Eater', weights: [400] }
  ],
  tamil: [
    { name: 'Noto Sans Tamil', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Hind Madurai', weights: [300, 400, 500, 600, 700] },
    { name: 'Arima Madurai', weights: [100, 200, 300, 400, 500, 700, 800, 900] },
    { name: 'Mukta Malar', weights: [200, 300, 400, 500, 600, 700, 800] },
    { name: 'Coiny', weights: [400] },
    { name: 'Pavanam', weights: [400] },
    { name: 'Latha', weights: [400] },
    { name: 'Vijaya', weights: [400, 700] },
    { name: 'Kavivanar', weights: [400] },
    { name: 'Meera Inimai', weights: [400] },
    { name: 'Baloo Thambi 2', weights: [400, 500, 600, 700, 800] },
    { name: 'Tiro Tamil', weights: [400] },
    { name: 'Anek Tamil', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { name: 'Noto Serif Tamil', weights: [400, 500, 600, 700] },
    { name: 'Catamaran', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'Sree Krushnadevaraya', weights: [400] },
    { name: 'Suranna', weights: [400] },
    { name: 'Ramabhadra', weights: [400] },
    { name: 'Tenali Ramakrishna', weights: [400] },
    { name: 'Gidugu', weights: [400] },
    { name: 'Gurajada', weights: [400] },
    { name: 'Mallanna', weights: [400] },
    { name: 'Mandali', weights: [400] },
    { name: 'NTR', weights: [400] },
    { name: 'Ponnala', weights: [400] }
  ],
  telugu: [
    { name: 'Noto Sans Telugu', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Hind Guntur', weights: [300, 400, 500, 600, 700] },
    { name: 'Mandali', weights: [400] },
    { name: 'NTR', weights: [400] },
    { name: 'Suravaram', weights: [400] },
    { name: 'Ramabhadra', weights: [400] },
    { name: 'Sree Krushnadevaraya', weights: [400] },
    { name: 'Tenali Ramakrishna', weights: [400] },
    { name: 'Mallanna', weights: [400] },
    { name: 'Dhurjati', weights: [400] },
    { name: 'Gidugu', weights: [400] },
    { name: 'Gurajada', weights: [400] },
    { name: 'Ponnala', weights: [400] },
    { name: 'Ravi Prakash', weights: [400] },
    { name: 'Baloo Tammudu 2', weights: [400, 500, 600, 700, 800] },
    { name: 'Tiro Telugu', weights: [400] },
    { name: 'Anek Telugu', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { name: 'Noto Serif Telugu', weights: [400, 500, 600, 700] },
    { name: 'Lakki Reddy', weights: [400] },
    { name: 'Peddana', weights: [400] },
    { name: 'Timmana', weights: [400] },
    { name: 'Vada', weights: [400] },
    { name: 'Amethysta', weights: [400] },
    { name: 'Arya', weights: [400, 700] },
    { name: 'Asar', weights: [400] }
  ],
  gujarati: [
    { name: 'Noto Sans Gujarati', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Hind Vadodara', weights: [300, 400, 500, 600, 700] },
    { name: 'Baloo Bhai 2', weights: [400, 500, 600, 700, 800] },
    { name: 'Anek Gujarati', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { name: 'Noto Serif Gujarati', weights: [400, 500, 600, 700] },
    { name: 'Rasa', weights: [300, 400, 500, 600, 700] },
    { name: 'Shrikhand', weights: [400] },
    { name: 'Mukta Malar', weights: [200, 300, 400, 500, 600, 700, 800] },
    { name: 'Mina', weights: [400, 700] },
    { name: 'Kumar One', weights: [400] },
    { name: 'Kumar One Outline', weights: [400] },
    { name: 'Farsan', weights: [400] },
    { name: 'Fasthand', weights: [400] },
    { name: 'Freehand', weights: [400] },
    { name: 'Hanuman', weights: [400, 700] },
    { name: 'Kantumruy', weights: [300, 400, 700] },
    { name: 'Metal', weights: [400] },
    { name: 'Moul', weights: [400] },
    { name: 'Moulpali', weights: [400] },
    { name: 'Odor Mean Chey', weights: [400] },
    { name: 'Preahvihear', weights: [400] },
    { name: 'Suwannaphum', weights: [400] },
    { name: 'Taprom', weights: [400] },
    { name: 'Bayon', weights: [400] },
    { name: 'Bokor', weights: [400] }
  ],
  kannada: [
    { name: 'Noto Sans Kannada', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Hind Mysuru', weights: [300, 400, 500, 600, 700] },
    { name: 'Baloo Tamma 2', weights: [400, 500, 600, 700, 800] },
    { name: 'Tiro Kannada', weights: [400] },
    { name: 'Anek Kannada', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { name: 'Noto Serif Kannada', weights: [400, 500, 600, 700] },
    { name: 'Arima', weights: [100, 200, 300, 400, 500, 600, 700] },
    { name: 'Arima Madurai', weights: [100, 200, 300, 400, 500, 700, 800, 900] },
    { name: 'Pavanam', weights: [400] },
    { name: 'Kavivanar', weights: [400] },
    { name: 'Gidugu', weights: [400] },
    { name: 'Gurajada', weights: [400] },
    { name: 'Mallanna', weights: [400] },
    { name: 'Mandali', weights: [400] },
    { name: 'NTR', weights: [400] },
    { name: 'Ponnala', weights: [400] },
    { name: 'Ramabhadra', weights: [400] },
    { name: 'Ravi Prakash', weights: [400] },
    { name: 'Sree Krushnadevaraya', weights: [400] },
    { name: 'Suravaram', weights: [400] },
    { name: 'Tenali Ramakrishna', weights: [400] },
    { name: 'Dhurjati', weights: [400] },
    { name: 'Lakki Reddy', weights: [400] },
    { name: 'Peddana', weights: [400] },
    { name: 'Timmana', weights: [400] }
  ],
  malayalam: [
    { name: 'Noto Sans Malayalam', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Manjari', weights: [100, 400, 700] },
    { name: 'Baloo Chettan 2', weights: [400, 500, 600, 700, 800] },
    { name: 'Tiro Malayalam', weights: [400] },
    { name: 'Chilanka', weights: [400] },
    { name: 'Anek Malayalam', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { name: 'Gayathri', weights: [100, 400, 700] },
    { name: 'Noto Serif Malayalam', weights: [400, 500, 600, 700] },
    { name: 'AnjaliOldLipi', weights: [400] },
    { name: 'Meera', weights: [400] },
    { name: 'Suruma', weights: [400] },
    { name: 'Karumbi', weights: [400] },
    { name: 'Keraleeyam', weights: [400] },
    { name: 'Uroob', weights: [400] },
    { name: 'Rachana', weights: [400] },
    { name: 'Firma', weights: [400] },
    { name: 'Dhurjati', weights: [400] },
    { name: 'Gidugu', weights: [400] },
    { name: 'Gurajada', weights: [400] },
    { name: 'Mallanna', weights: [400] },
    { name: 'Mandali', weights: [400] },
    { name: 'NTR', weights: [400] },
    { name: 'Ponnala', weights: [400] },
    { name: 'Ramabhadra', weights: [400] },
    { name: 'Ravi Prakash', weights: [400] }
  ],
  punjabi: [
    { name: 'Mukta Vaani', weights: [200, 300, 400, 500, 600, 700, 800] },
    { name: 'Noto Sans Gurmukhi', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Hind Jalandhar', weights: [300, 400, 500, 600, 700] },
    { name: 'Baloo Paaji 2', weights: [400, 500, 600, 700, 800] },
    { name: 'Anek Gurmukhi', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { name: 'Noto Serif Gurmukhi', weights: [400, 500, 600, 700] },
    { name: 'Tiro Gurmukhi', weights: [400] },
    { name: 'Modak', weights: [400] },
    { name: 'Admit One', weights: [400] },
    { name: 'Salsa', weights: [400] },
    { name: 'Shrikhand', weights: [400] },
    { name: 'Akronim', weights: [400] },
    { name: 'Farsan', weights: [400] },
    { name: 'Gorditas', weights: [400, 700] },
    { name: 'Lily Script One', weights: [400] },
    { name: 'Margarine', weights: [400] },
    { name: 'Oregano', weights: [400, 400] },
    { name: 'Sail', weights: [400] },
    { name: 'Underdog', weights: [400] },
    { name: 'Vampiro One', weights: [400] },
    { name: 'Aladin', weights: [400] },
    { name: 'Atma', weights: [300, 400, 500, 600, 700] },
    { name: 'Buda', weights: [300] },
    { name: 'Delius', weights: [400] },
    { name: 'Eater', weights: [400] }
  ],
  odia: [
    { name: 'Noto Sans Oriya', weights: [400, 700] },
    { name: 'Baloo Bhaina 2', weights: [400, 500, 600, 700, 800] },
    { name: 'Tiro Odia', weights: [400] },
    { name: 'Anek Odia', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { name: 'Noto Serif Oriya', weights: [400, 500, 600, 700] },
    { name: 'Mukta', weights: [200, 300, 400, 500, 600, 700, 800] },
    { name: 'Yantramanav', weights: [100, 300, 400, 500, 700, 900] },
    { name: 'Khand', weights: [300, 400, 500, 600, 700] },
    { name: 'Rajdhani', weights: [300, 400, 500, 600, 700] },
    { name: 'Teko', weights: [300, 400, 500, 600, 700] },
    { name: 'Kalam', weights: [300, 400, 700] },
    { name: 'Karma', weights: [300, 400, 500, 600, 700] },
    { name: 'Rozha One', weights: [400] },
    { name: 'Vesper Libre', weights: [400, 500, 700, 900] },
    { name: 'Amita', weights: [400, 700] },
    { name: 'Shrikhand', weights: [400] },
    { name: 'Halant', weights: [300, 400, 500, 600, 700] },
    { name: 'Kurale', weights: [400] },
    { name: 'Arya', weights: [400, 700] },
    { name: 'Inknut Antiqua', weights: [300, 400, 500, 600, 700, 800, 900] },
    { name: 'Eczar', weights: [400, 500, 600, 700, 800] },
    { name: 'Sahitya', weights: [400, 700] },
    { name: 'Rhodium Libre', weights: [400] },
    { name: 'Sumana', weights: [400, 700] },
    { name: 'Martel', weights: [200, 300, 400, 600, 700, 800, 900] }
  ],
  arabic: [
    { name: 'Noto Sans Arabic', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Cairo', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'Tajawal', weights: [200, 300, 400, 500, 700, 800, 900] },
    { name: 'Amiri', weights: [400, 700] },
    { name: 'El Messiri', weights: [400, 500, 600, 700] },
    { name: 'Scheherazade New', weights: [400, 500, 600, 700] },
    { name: 'Lateef', weights: [400, 700] },
    { name: 'Readex Pro', weights: [200, 300, 400, 500, 600, 700] },
    { name: 'Almarai', weights: [300, 400, 700, 800] },
    { name: 'Changa', weights: [200, 300, 400, 500, 600, 700, 800] },
    { name: 'Markazi Text', weights: [400, 500, 600, 700] },
    { name: 'Lalezar', weights: [400] },
    { name: 'Reem Kufi', weights: [400, 500, 600, 700] },
    { name: 'Mada', weights: [200, 300, 400, 500, 600, 700, 900] },
    { name: 'Aref Ruqaa', weights: [400, 700] },
    { name: 'Harmattan', weights: [400, 700] },
    { name: 'Lemonada', weights: [300, 400, 500, 600, 700] },
    { name: 'Katibeh', weights: [400] },
    { name: 'Mirza', weights: [400, 500, 600, 700] },
    { name: 'Jomhuria', weights: [400] },
    { name: 'Rakkas', weights: [400] },
    { name: 'Vibes', weights: [400] },
    { name: 'Blaka', weights: [400] },
    { name: 'Blaka Hollow', weights: [400] },
    { name: 'Blaka Ink', weights: [400] }
  ],
  chinese: [
    { name: 'Noto Sans SC', weights: [100, 300, 400, 500, 700, 900] },
    { name: 'Noto Sans TC', weights: [100, 300, 400, 500, 700, 900] },
    { name: 'Noto Serif SC', weights: [200, 300, 400, 500, 600, 700, 900] },
    { name: 'Noto Serif TC', weights: [200, 300, 400, 500, 600, 700, 900] },
    { name: 'ZCOOL XiaoWei', weights: [400] },
    { name: 'ZCOOL QingKe HuangYou', weights: [400] },
    { name: 'Ma Shan Zheng', weights: [400] },
    { name: 'Liu Jian Mao Cao', weights: [400] },
    { name: 'Zhi Mang Xing', weights: [400] },
    { name: 'ZCOOL KuaiLe', weights: [400] },
    { name: 'Long Cang', weights: [400] },
    { name: 'Noto Sans HK', weights: [100, 300, 400, 500, 700, 900] },
    { name: 'Noto Serif HK', weights: [200, 300, 400, 500, 600, 700, 900] },
    { name: 'Rampart One', weights: [400] },
    { name: 'Reggae One', weights: [400] },
    { name: 'Train One', weights: [400] },
    { name: 'RocknRoll One', weights: [400] },
    { name: 'DotGothic16', weights: [400] },
    { name: 'Stick', weights: [400] },
    { name: 'Yusei Magic', weights: [400] },
    { name: 'Hachi Maru Pop', weights: [400] },
    { name: 'Potta One', weights: [400] },
    { name: 'Palette Mosaic', weights: [400] },
    { name: 'Dela Gothic One', weights: [400] },
    { name: 'New Tegomin', weights: [400] }
  ],
  japanese: [
    { name: 'Noto Sans JP', weights: [100, 300, 400, 500, 700, 900] },
    { name: 'M PLUS Rounded 1c', weights: [100, 300, 400, 500, 700, 800, 900] },
    { name: 'Noto Serif JP', weights: [200, 300, 400, 500, 600, 700, 900] },
    { name: 'Kosugi Maru', weights: [400] },
    { name: 'Sawarabi Mincho', weights: [400] },
    { name: 'Sawarabi Gothic', weights: [400] },
    { name: 'Zen Maru Gothic', weights: [300, 400, 500, 700, 900] },
    { name: 'Kiwi Maru', weights: [300, 400, 500] },
    { name: 'Zen Antique', weights: [400] },
    { name: 'Zen Antique Soft', weights: [400] },
    { name: 'Zen Kaku Gothic New', weights: [300, 400, 500, 700, 900] },
    { name: 'Zen Kaku Gothic Antique', weights: [300, 400, 500, 700, 900] },
    { name: 'Zen Kurenaido', weights: [400] },
    { name: 'Zen Old Mincho', weights: [400, 700, 900] },
    { name: 'Kaisei Decol', weights: [400, 500, 700] },
    { name: 'Kaisei HarunoUmi', weights: [400, 500, 700] },
    { name: 'Kaisei Opti', weights: [400, 500, 700] },
    { name: 'Kaisei Tokumin', weights: [400, 500, 700, 800] },
    { name: 'Yomogi', weights: [400] },
    { name: 'Potta One', weights: [400] },
    { name: 'Dela Gothic One', weights: [400] },
    { name: 'DotGothic16', weights: [400] },
    { name: 'Reggae One', weights: [400] },
    { name: 'Rampart One', weights: [400] },
    { name: 'Train One', weights: [400] }
  ],
  korean: [
    { name: 'Noto Sans KR', weights: [100, 300, 400, 500, 700, 900] },
    { name: 'Nanum Gothic', weights: [400, 700, 800] },
    { name: 'Nanum Myeongjo', weights: [400, 700, 800] },
    { name: 'Gothic A1', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'Do Hyeon', weights: [400] },
    { name: 'Jua', weights: [400] },
    { name: 'Black Han Sans', weights: [400] },
    { name: 'Sunflower', weights: [300, 500, 700] },
    { name: 'Noto Serif KR', weights: [200, 300, 400, 500, 600, 700, 900] },
    { name: 'Nanum Pen Script', weights: [400] },
    { name: 'Nanum Brush Script', weights: [400] },
    { name: 'Single Day', weights: [400] },
    { name: 'Yeon Sung', weights: [400] },
    { name: 'Hammersmith One', weights: [400] },
    { name: 'Hi Melody', weights: [400] },
    { name: 'Dongle', weights: [300, 400, 700] },
    { name: 'Song Myung', weights: [400] },
    { name: 'Gugi', weights: [400] },
    { name: 'Gaegu', weights: [300, 400, 700] },
    { name: 'Gowun Dodum', weights: [400] },
    { name: 'Gowun Batang', weights: [400, 700] },
    { name: 'Gamja Flower', weights: [400] },
    { name: 'Cute Font', weights: [400] },
    { name: 'Stylish', weights: [400] },
    { name: 'Kirang Haerang', weights: [400] }
  ],
  thai: [
    { name: 'Noto Sans Thai', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'Sarabun', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { name: 'Prompt', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'Kanit', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'Mitr', weights: [200, 300, 400, 500, 600, 700] },
    { name: 'Pridi', weights: [200, 300, 400, 500, 600, 700] },
    { name: 'Itim', weights: [400] },
    { name: 'Charm', weights: [400, 700] },
    { name: 'Mali', weights: [200, 300, 400, 500, 600, 700] },
    { name: 'Chakra Petch', weights: [300, 400, 500, 600, 700] },
    { name: 'Krub', weights: [200, 300, 400, 500, 600, 700] },
    { name: 'Taviraj', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'Athiti', weights: [200, 300, 400, 500, 600, 700] },
    { name: 'Trirong', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
    { name: 'Niramit', weights: [200, 300, 400, 500, 600, 700] },
    { name: 'Sriracha', weights: [400] },
    { name: 'Charmonman', weights: [400, 700] },
    { name: 'Chonburi', weights: [400] },
    { name: 'K2D', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
    { name: 'Thasadith', weights: [400, 700] },
    { name: 'Fahkwang', weights: [200, 300, 400, 500, 600, 700] },
    { name: 'Pattaya', weights: [400] },
    { name: 'Maitree', weights: [200, 300, 400, 500, 600, 700] },
    { name: 'Bai Jamjuree', weights: [200, 300, 400, 500, 600, 700] },
    { name: 'Srisakdi', weights: [400, 700] }
  ],
  latin: [
    { name: 'Helvetica', weights: [400, 700] },
    { name: 'Arial', weights: [400, 700] },
    { name: 'Times New Roman', weights: [400, 700] },
    { name: 'Calibri', weights: [400, 700] },
    { name: 'Roboto', weights: [300, 400, 500, 700] },
    { name: 'Verdana', weights: [400, 700] },
    { name: 'Georgia', weights: [400, 700] },
    { name: 'Montserrat', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Open Sans', weights: [300, 400, 500, 600, 700, 800] },
    { name: 'Lato', weights: [300, 400, 700] },
    { name: 'Futura', weights: [400, 700] },
    { name: 'Garamond', weights: [400, 700] },
    { name: 'Bodoni', weights: [400, 700] },
    { name: 'Didot', weights: [400, 700] },
    { name: 'Comic Sans MS', weights: [400, 700] }
  ]
};

export const popularLatinFonts = [
  { name: 'Helvetica', weights: [400, 700] },
  { name: 'Arial', weights: [400, 700] },
  { name: 'Times New Roman', weights: [400, 700] },
  { name: 'Calibri', weights: [400, 700] },
  { name: 'Roboto', weights: [300, 400, 500, 700] },
  { name: 'Verdana', weights: [400, 700] },
  { name: 'Georgia', weights: [400, 700] },
  { name: 'Montserrat', weights: [300, 400, 500, 600, 700, 800] },
  { name: 'Open Sans', weights: [300, 400, 500, 600, 700, 800] },
  { name: 'Lato', weights: [300, 400, 700] },
  { name: 'Futura', weights: [400, 700] },
  { name: 'Garamond', weights: [400, 700] },
  { name: 'Bodoni', weights: [400, 700] },
  { name: 'Didot', weights: [400, 700] },
  { name: 'Comic Sans MS', weights: [400, 700] }
];
export function getFontOptionsForScript(script) {
  if (script === 'latin') return scriptFontMap.latin;
  const nativeFonts = scriptFontMap[script] || [];
  if (nativeFonts.length === 0) return scriptFontMap.latin;
  const nativeNames = new Set(nativeFonts.map(f => f.name));
  const extras = popularLatinFonts.filter(f => !nativeNames.has(f.name));
  return [...extras, ...nativeFonts];
}

export const systemFonts = new Set([
  'Helvetica', 'Arial', 'Times New Roman', 'Calibri', 'Verdana',
  'Georgia', 'Futura', 'Garamond', 'Bodoni', 'Didot', 'Comic Sans MS'
]);

// Track which weights have been loaded per font so we can load additional weights on demand
const _loadedFontWeights = {};

export function loadGoogleFont(fontName, weights = [400, 700]) {
  if (systemFonts.has(fontName)) {
    return Promise.resolve();
  }

  const safeKey = fontName.replace(/\s+/g, '-');

  // Find which of the requested weights are not yet loaded
  const alreadyLoaded = _loadedFontWeights[safeKey] || new Set();
  const missing = weights.filter(w => !alreadyLoaded.has(w));

  if (missing.length === 0) {
    // All requested weights already loaded
    return Promise.resolve();
  }

  // Merge with already-loaded weights for the new link tag
  const allWeights = [...new Set([...alreadyLoaded, ...missing])].sort((a, b) => a - b);

  // Use a unique ID so the old link stays alive until the new one loads successfully
  const newLinkId = `font-${safeKey}-${Date.now()}`;

  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.id = newLinkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@${allWeights.join(';')}&display=swap`;

    link.onload = () => {
      // Record all weights now loaded
      _loadedFontWeights[safeKey] = new Set(allWeights);
      // Remove any older links for this font now that the new one is live
      document.querySelectorAll(`link[id^="font-${safeKey}-"]`).forEach(el => {
        if (el.id !== newLinkId) el.remove();
      });
      resolve();
    };
    link.onerror = () => {
      // Remove the failed link — old one (if any) stays intact
      link.remove();
      reject(new Error(`Failed to load font: ${fontName}`));
    };

    document.head.appendChild(link);
  });
}

export async function autoLoadFontForText(text) {
  const script = detectScript(text);
  
  // Explicitly handle script-to-font mapping for Hindi/Hinglish vs Global default
  if (script === 'devanagari') {
    try {
      await loadGoogleFont('Noto Sans', [300, 400, 500, 600, 700, 800]);
      return { fontFamily: 'Noto Sans', script, fontOptions: scriptFontMap.devanagari };
    } catch (error) {
      console.error('Failed to load Noto Sans:', error);
    }
  }

  // Global default: Inter
  try {
    await loadGoogleFont('Inter', [300, 400, 500, 600, 700, 800]);
    return { fontFamily: 'Inter', script: 'latin', fontOptions: scriptFontMap.latin };
  } catch (error) {
    console.error('Failed to load Inter fallback:', error);
    return { fontFamily: 'sans-serif', script: 'latin', fontOptions: scriptFontMap.latin };
  }
}

export function getAllFontsForScript(script) {
  const fonts = scriptFontMap[script] || scriptFontMap.latin;
  return fonts.map(f => f.name);
}
