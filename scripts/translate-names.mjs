/**
 * 批量翻译机场/港口名称为中文
 * 使用规则翻译 + 常用词汇表的方式
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载中国城市拼音对照
const chinaCitiesPinyinPath = path.join(__dirname, '../data/raw/china-cities-pinyin.json');
const chinaCitiesPinyin = JSON.parse(fs.readFileSync(chinaCitiesPinyinPath, 'utf-8')).cities;

// 常用英文词汇的中文翻译
const commonWords = {
  // 机场类型
  'International': '国际',
  'Intl': '国际',
  'Regional': '地区',
  'Municipal': '市政',
  'County': '县',
  'Metropolitan': '大都会',
  'Executive': '公务',
  'General Aviation': '通用航空',
  'Air Force Base': '空军基地',
  'AFB': '空军基地',
  'Naval Air Station': '海军航空站',
  'NAS': '海军航空站',
  'Army Airfield': '陆军机场',
  'AAF': '陆军机场',
  'Heliport': '直升机场',
  'Seaplane Base': '水上飞机基地',
  'SPB': '水上飞机基地',
  'Airpark': '航空公园',
  'Airfield': '机场',
  'Airstrip': '简易机场',
  'Airport': '机场',
  'Field': '机场',
  'Memorial': '纪念',
  'National': '国家',
  
  // 方位词
  'North': '北',
  'South': '南',
  'East': '东',
  'West': '西',
  'Northeast': '东北',
  'Northwest': '西北',
  'Southeast': '东南',
  'Southwest': '西南',
  'Central': '中央',
  'Downtown': '市中心',
  'Midway': '中途',
  
  // 港口类型
  'Port': '港',
  'Harbor': '港',
  'Harbour': '港',
  'Terminal': '码头',
  'Wharf': '码头',
  'Dock': '船坞',
  'Marina': '游艇港',
  'Anchorage': '锚地',
  'Bay': '湾',
  'Island': '岛',
  'Point': '角',
  'Pt': '角',
  'Cape': '海角',
  'River': '河',
  'Lake': '湖',
  'Creek': '溪',
  'Beach': '海滩',
  'Coast': '海岸',
  'Sea': '海',
  'Ocean': '洋',
  
  // 常见地名后缀
  'City': '城',
  'Town': '镇',
  'Village': '村',
  'Valley': '谷',
  'Hill': '山',
  'Hills': '山',
  'Mountain': '山',
  'Mountains': '山脉',
  'Springs': '泉',
  'Falls': '瀑布',
  'Park': '公园',
  'Forest': '森林',
  'Woods': '林',
  'Grove': '林',
  'Heights': '高地',
  'Plains': '平原',
  'Prairie': '草原',
  'Desert': '沙漠',
  'Canyon': '峡谷',
  
  // 常见人名/称号
  'King': '国王',
  'Queen': '女王',
  'Prince': '王子',
  'Princess': '公主',
  'President': '总统',
  'General': '将军',
  'Saint': '圣',
  'St': '圣',
  'San': '圣',
  'Santa': '圣',
  'Santo': '圣',
  
  // 其他常用词
  'New': '新',
  'Old': '老',
  'Great': '大',
  'Little': '小',
  'Big': '大',
  'Upper': '上',
  'Lower': '下',
  'Grand': '大',
  'Royal': '皇家',
  'United': '联合',
  'Free': '自由'
};

// 主要城市完整翻译（补充更多）
const cityTranslations = {
  // 美国主要城市（补充）
  'Philadelphia': '费城',
  'Blacksburg': '布莱克斯堡',
  'Broken Bow': '布罗肯博',
  'Bear Creek': '熊溪',
  'Bryce Canyon': '布莱斯峡谷',
  'Belle Chasse': '贝尔查斯',
  'Bay City': '海湾城',
  'Brady': '布雷迪',
  'Benson': '本森',
  'Aberdeen': '阿伯丁',
  'Abilene': '阿比林',
  'Akron': '阿克伦',
  'Albany': '奥尔巴尼',
  'Alexandria': '亚历山大',
  'Allentown': '阿伦敦',
  'Amarillo': '阿马里洛',
  'Anchorage': '安克雷奇',
  'Ann Arbor': '安娜堡',
  'Appleton': '阿普尔顿',
  'Asheville': '阿什维尔',
  'Augusta': '奥古斯塔',
  'Aurora': '奥罗拉',
  'Bakersfield': '贝克斯菲尔德',
  'Bangor': '班戈',
  'Baton Rouge': '巴吞鲁日',
  'Beaumont': '博蒙特',
  'Bellingham': '贝灵厄姆',
  'Billings': '比林斯',
  'Biloxi': '比洛克西',
  'Bismarck': '俾斯麦',
  'Bloomington': '布卢明顿',
  'Boise': '博伊西',
  'Boulder': '博尔德',
  'Bowling Green': '鲍灵格林',
  'Bozeman': '博兹曼',
  'Bridgeport': '布里奇波特',
  'Brownsville': '布朗斯维尔',
  'Buffalo': '布法罗',
  'Burlington': '伯灵顿',
  'Cambridge': '剑桥',
  'Canton': '坎顿',
  'Cape Coral': '珊瑚角',
  'Carson City': '卡森城',
  'Cedar Rapids': '锡达拉皮兹',
  'Champaign': '香槟',
  'Charleston': '查尔斯顿',
  'Chattanooga': '查塔努加',
  'Cheyenne': '夏延',
  'Clearwater': '克利尔沃特',
  'Colorado Springs': '科罗拉多斯普林斯',
  'Columbia': '哥伦比亚',
  'Columbus': '哥伦布',
  'Concord': '康科德',
  'Corpus Christi': '科珀斯克里斯蒂',
  'Dallas': '达拉斯',
  'Davenport': '达文波特',
  'Dayton': '代顿',
  'Daytona Beach': '代托纳海滩',
  'Dearborn': '迪尔伯恩',
  'Decatur': '迪凯特',
  'Denver': '丹佛',
  'Des Moines': '得梅因',
  'Detroit': '底特律',
  'Dothan': '多森',
  'Dover': '多佛',
  'Duluth': '德卢斯',
  'Durham': '达勒姆',
  'El Paso': '埃尔帕索',
  'Elizabeth': '伊丽莎白',
  'Elkhart': '埃尔克哈特',
  'Erie': '伊利',
  'Eugene': '尤金',
  'Evansville': '埃文斯维尔',
  'Fairbanks': '费尔班克斯',
  'Fargo': '法戈',
  'Fayetteville': '费耶特维尔',
  'Flagstaff': '弗拉格斯塔夫',
  'Flint': '弗林特',
  'Florence': '佛罗伦萨',
  'Fort Collins': '柯林斯堡',
  'Fort Lauderdale': '劳德代尔堡',
  'Fort Myers': '迈尔斯堡',
  'Fort Smith': '史密斯堡',
  'Fort Wayne': '韦恩堡',
  'Fort Worth': '沃斯堡',
  'Fresno': '弗雷斯诺',
  'Gainesville': '盖恩斯维尔',
  'Gary': '加里',
  'Gilbert': '吉尔伯特',
  'Glendale': '格伦代尔',
  'Grand Forks': '大福克斯',
  'Grand Junction': '大章克申',
  'Grand Rapids': '大急流城',
  'Great Falls': '大瀑布城',
  'Green Bay': '绿湾',
  'Greensboro': '格林斯伯勒',
  'Greenville': '格林维尔',
  'Gulfport': '格尔夫波特',
  'Hagerstown': '黑格斯敦',
  'Hampton': '汉普顿',
  'Harrisburg': '哈里斯堡',
  'Hartford': '哈特福德',
  'Hattiesburg': '哈蒂斯堡',
  'Helena': '海伦娜',
  'Hialeah': '海厄利亚',
  'Hickory': '希科里',
  'High Point': '高点',
  'Hollywood': '好莱坞',
  'Honolulu': '檀香山',
  'Hot Springs': '温泉城',
  'Houma': '霍马',
  'Houston': '休斯顿',
  'Huntington': '亨廷顿',
  'Huntsville': '亨茨维尔',
  'Indianapolis': '印第安纳波利斯',
  'Iowa City': '艾奥瓦城',
  'Irvine': '尔湾',
  'Irving': '欧文',
  'Jackson': '杰克逊',
  'Jacksonville': '杰克逊维尔',
  'Jersey City': '泽西城',
  'Johnson City': '约翰逊城',
  'Joliet': '乔利埃特',
  'Joplin': '乔普林',
  'Juneau': '朱诺',
  'Kalamazoo': '卡拉马祖',
  'Kansas City': '堪萨斯城',
  'Kennewick': '肯纳威克',
  'Key West': '基韦斯特',
  'Killeen': '基林',
  'Knoxville': '诺克斯维尔',
  'La Crosse': '拉克罗斯',
  'Lafayette': '拉斐特',
  'Lake Charles': '查尔斯湖',
  'Lakeland': '莱克兰',
  'Lancaster': '兰开斯特',
  'Lansing': '兰辛',
  'Laredo': '拉雷多',
  'Las Cruces': '拉斯克鲁塞斯',
  'Las Vegas': '拉斯维加斯',
  'Lawton': '劳顿',
  'Lexington': '列克星敦',
  'Lincoln': '林肯',
  'Little Rock': '小石城',
  'Long Beach': '长滩',
  'Longview': '朗维尤',
  'Los Angeles': '洛杉矶',
  'Louisville': '路易维尔',
  'Lubbock': '拉伯克',
  'Lynchburg': '林奇堡',
  'Macon': '梅肯',
  'Madison': '麦迪逊',
  'Manchester': '曼彻斯特',
  'McAllen': '麦卡伦',
  'Medford': '梅德福',
  'Melbourne': '墨尔本',
  'Memphis': '孟菲斯',
  'Merced': '默塞德',
  'Mesa': '梅萨',
  'Miami': '迈阿密',
  'Midland': '米德兰',
  'Milwaukee': '密尔沃基',
  'Minneapolis': '明尼阿波利斯',
  'Missoula': '米苏拉',
  'Mobile': '莫比尔',
  'Modesto': '莫德斯托',
  'Monroe': '门罗',
  'Montgomery': '蒙哥马利',
  'Morgantown': '摩根敦',
  'Myrtle Beach': '默特尔比奇',
  'Naples': '那不勒斯',
  'Nashville': '纳什维尔',
  'New Haven': '纽黑文',
  'New Orleans': '新奥尔良',
  'New York': '纽约',
  'Newark': '纽瓦克',
  'Newport News': '纽波特纽斯',
  'Norfolk': '诺福克',
  'Norman': '诺曼',
  'North Charleston': '北查尔斯顿',
  'Oakland': '奥克兰',
  'Ocala': '奥卡拉',
  'Odessa': '敖德萨',
  'Ogden': '奥格登',
  'Oklahoma City': '俄克拉荷马城',
  'Olympia': '奥林匹亚',
  'Omaha': '奥马哈',
  'Ontario': '安大略',
  'Orange': '奥兰治',
  'Orlando': '奥兰多',
  'Oshkosh': '奥什科什',
  'Overland Park': '欧弗兰帕克',
  'Oxnard': '奥克斯纳德',
  'Palm Bay': '棕榈湾',
  'Palm Springs': '棕榈泉',
  'Panama City': '巴拿马城',
  'Parkersburg': '帕克斯堡',
  'Pasadena': '帕萨迪纳',
  'Paterson': '帕特森',
  'Pensacola': '彭萨科拉',
  'Peoria': '皮奥里亚',
  'Philadelphia': '费城',
  'Phoenix': '菲尼克斯',
  'Pittsburgh': '匹兹堡',
  'Plano': '普莱诺',
  'Pocatello': '波卡特洛',
  'Portland': '波特兰',
  'Portsmouth': '朴茨茅斯',
  'Poughkeepsie': '波基普西',
  'Providence': '普罗维登斯',
  'Provo': '普罗沃',
  'Pueblo': '普韦布洛',
  'Raleigh': '罗利',
  'Rapid City': '拉皮德城',
  'Reading': '雷丁',
  'Redding': '雷丁',
  'Reno': '里诺',
  'Richmond': '里士满',
  'Riverside': '里弗赛德',
  'Roanoke': '罗阿诺克',
  'Rochester': '罗切斯特',
  'Rockford': '罗克福德',
  'Sacramento': '萨克拉门托',
  'Saginaw': '萨吉诺',
  'Salem': '塞勒姆',
  'Salinas': '萨利纳斯',
  'Salt Lake City': '盐湖城',
  'San Angelo': '圣安吉洛',
  'San Antonio': '圣安东尼奥',
  'San Bernardino': '圣贝纳迪诺',
  'San Diego': '圣迭戈',
  'San Francisco': '旧金山',
  'San Jose': '圣何塞',
  'San Juan': '圣胡安',
  'Santa Ana': '圣安娜',
  'Santa Barbara': '圣巴巴拉',
  'Santa Clara': '圣克拉拉',
  'Santa Cruz': '圣克鲁斯',
  'Santa Fe': '圣菲',
  'Santa Maria': '圣玛丽亚',
  'Santa Rosa': '圣罗莎',
  'Sarasota': '萨拉索塔',
  'Savannah': '萨凡纳',
  'Scottsdale': '斯科茨代尔',
  'Scranton': '斯克兰顿',
  'Seattle': '西雅图',
  'Shreveport': '什里夫波特',
  'Sioux City': '苏城',
  'Sioux Falls': '苏福尔斯',
  'South Bend': '南本德',
  'Spartanburg': '斯帕坦堡',
  'Spokane': '斯波坎',
  'Springfield': '斯普林菲尔德',
  'St. Cloud': '圣克劳德',
  'St. George': '圣乔治',
  'St. Joseph': '圣约瑟夫',
  'St. Louis': '圣路易斯',
  'St. Paul': '圣保罗',
  'St. Petersburg': '圣彼得斯堡',
  'Stamford': '斯坦福',
  'State College': '州学院',
  'Stockton': '斯托克顿',
  'Syracuse': '锡拉丘兹',
  'Tacoma': '塔科马',
  'Tallahassee': '塔拉哈西',
  'Tampa': '坦帕',
  'Tempe': '坦佩',
  'Terre Haute': '特雷霍特',
  'Texarkana': '特克萨卡纳',
  'Toledo': '托莱多',
  'Topeka': '托皮卡',
  'Trenton': '特伦顿',
  'Tucson': '图森',
  'Tulsa': '塔尔萨',
  'Tuscaloosa': '塔斯卡卢萨',
  'Tyler': '泰勒',
  'Utica': '尤蒂卡',
  'Valdosta': '瓦尔多斯塔',
  'Vancouver': '温哥华',
  'Victoria': '维多利亚',
  'Waco': '韦科',
  'Washington': '华盛顿',
  'Waterbury': '沃特伯里',
  'Waterloo': '滑铁卢',
  'West Palm Beach': '西棕榈滩',
  'Wichita': '威奇托',
  'Wichita Falls': '威奇托福尔斯',
  'Wilkes-Barre': '威尔克斯-巴里',
  'Wilmington': '威尔明顿',
  'Winston-Salem': '温斯顿-塞勒姆',
  'Worcester': '伍斯特',
  'Yakima': '亚基马',
  'Yonkers': '扬克斯',
  'York': '约克',
  'Youngstown': '扬斯敦',
  'Yuma': '尤马',
  
  // 欧洲城市
  'London': '伦敦',
  'Paris': '巴黎',
  'Berlin': '柏林',
  'Madrid': '马德里',
  'Rome': '罗马',
  'Amsterdam': '阿姆斯特丹',
  'Vienna': '维也纳',
  'Barcelona': '巴塞罗那',
  'Munich': '慕尼黑',
  'Milan': '米兰',
  'Prague': '布拉格',
  'Dublin': '都柏林',
  'Brussels': '布鲁塞尔',
  'Lisbon': '里斯本',
  'Copenhagen': '哥本哈根',
  'Stockholm': '斯德哥尔摩',
  'Oslo': '奥斯陆',
  'Helsinki': '赫尔辛基',
  'Warsaw': '华沙',
  'Budapest': '布达佩斯',
  'Athens': '雅典',
  'Zurich': '苏黎世',
  'Geneva': '日内瓦',
  'Edinburgh': '爱丁堡',
  'Manchester': '曼彻斯特',
  'Glasgow': '格拉斯哥',
  'Frankfurt': '法兰克福',
  'Hamburg': '汉堡',
  'Cologne': '科隆',
  'Lyon': '里昂',
  'Marseille': '马赛',
  'Nice': '尼斯',
  'Venice': '威尼斯',
  'Florence': '佛罗伦萨',
  'Naples': '那不勒斯',
  'Rotterdam': '鹿特丹',
  'Antwerp': '安特卫普',
  'Gothenburg': '哥德堡',
  'Malmo': '马尔默',
  'Bergen': '卑尔根',
  'Krakow': '克拉科夫',
  'Gdansk': '格但斯克',
  'Bratislava': '布拉迪斯拉发',
  'Ljubljana': '卢布尔雅那',
  'Zagreb': '萨格勒布',
  'Belgrade': '贝尔格莱德',
  'Sofia': '索非亚',
  'Bucharest': '布加勒斯特',
  'Kiev': '基辅',
  'Kyiv': '基辅',
  'Minsk': '明斯克',
  'Riga': '里加',
  'Tallinn': '塔林',
  'Vilnius': '维尔纽斯',
  
  // 亚洲城市
  'Tokyo': '东京',
  'Osaka': '大阪',
  'Kyoto': '京都',
  'Yokohama': '横滨',
  'Nagoya': '名古屋',
  'Sapporo': '札幌',
  'Fukuoka': '福冈',
  'Kobe': '神户',
  'Seoul': '首尔',
  'Busan': '釜山',
  'Incheon': '仁川',
  'Bangkok': '曼谷',
  'Singapore': '新加坡',
  'Kuala Lumpur': '吉隆坡',
  'Jakarta': '雅加达',
  'Manila': '马尼拉',
  'Ho Chi Minh City': '胡志明市',
  'Hanoi': '河内',
  'Mumbai': '孟买',
  'Delhi': '德里',
  'New Delhi': '新德里',
  'Bangalore': '班加罗尔',
  'Chennai': '金奈',
  'Kolkata': '加尔各答',
  'Hyderabad': '海得拉巴',
  'Dubai': '迪拜',
  'Abu Dhabi': '阿布扎比',
  'Doha': '多哈',
  'Riyadh': '利雅得',
  'Jeddah': '吉达',
  'Tel Aviv': '特拉维夫',
  'Istanbul': '伊斯坦布尔',
  'Ankara': '安卡拉',
  'Tehran': '德黑兰',
  'Karachi': '卡拉奇',
  'Lahore': '拉合尔',
  'Dhaka': '达卡',
  'Colombo': '科伦坡',
  'Kathmandu': '加德满都',
  'Yangon': '仰光',
  'Phnom Penh': '金边',
  'Vientiane': '万象',
  
  // 非洲城市
  'Cairo': '开罗',
  'Johannesburg': '约翰内斯堡',
  'Cape Town': '开普敦',
  'Lagos': '拉各斯',
  'Nairobi': '内罗毕',
  'Casablanca': '卡萨布兰卡',
  'Algiers': '阿尔及尔',
  'Tunis': '突尼斯',
  'Addis Ababa': '亚的斯亚贝巴',
  'Accra': '阿克拉',
  'Dakar': '达喀尔',
  'Kinshasa': '金沙萨',
  'Luanda': '罗安达',
  'Dar es Salaam': '达累斯萨拉姆',
  'Khartoum': '喀土穆',
  'Abuja': '阿布贾',
  'Durban': '德班',
  'Pretoria': '比勒陀利亚',
  'Marrakech': '马拉喀什',
  
  // 大洋洲城市
  'Sydney': '悉尼',
  'Melbourne': '墨尔本',
  'Brisbane': '布里斯班',
  'Perth': '珀斯',
  'Adelaide': '阿德莱德',
  'Auckland': '奥克兰',
  'Wellington': '惠灵顿',
  'Christchurch': '基督城',
  'Queenstown': '皇后镇',
  'Fiji': '斐济',
  'Suva': '苏瓦',
  'Tahiti': '塔希提',
  'Papeete': '帕皮提',
  'Guam': '关岛',
  'Honolulu': '檀香山',
  
  // 南美城市
  'Sao Paulo': '圣保罗',
  'Rio de Janeiro': '里约热内卢',
  'Buenos Aires': '布宜诺斯艾利斯',
  'Lima': '利马',
  'Santiago': '圣地亚哥',
  'Bogota': '波哥大',
  'Caracas': '加拉加斯',
  'Montevideo': '蒙得维的亚',
  'Quito': '基多',
  'La Paz': '拉巴斯',
  'Asuncion': '亚松森',
  'Medellin': '麦德林',
  'Cali': '卡利',
  'Cartagena': '卡塔赫纳',
  'Cusco': '库斯科',
  'Brasilia': '巴西利亚',
  'Salvador': '萨尔瓦多',
  'Recife': '累西腓',
  'Fortaleza': '福塔莱萨',
  'Belo Horizonte': '贝洛奥里藏特',
  'Porto Alegre': '阿雷格里港',
  'Curitiba': '库里蒂巴',
  
  // 北美其他城市
  'Toronto': '多伦多',
  'Montreal': '蒙特利尔',
  'Vancouver': '温哥华',
  'Calgary': '卡尔加里',
  'Ottawa': '渥太华',
  'Edmonton': '埃德蒙顿',
  'Winnipeg': '温尼伯',
  'Quebec City': '魁北克城',
  'Halifax': '哈利法克斯',
  'Victoria': '维多利亚',
  'Mexico City': '墨西哥城',
  'Cancun': '坎昆',
  'Guadalajara': '瓜达拉哈拉',
  'Monterrey': '蒙特雷',
  'Tijuana': '蒂华纳',
  'Puerto Vallarta': '巴亚尔塔港',
  'Acapulco': '阿卡普尔科',
  'Havana': '哈瓦那',
  'San Juan': '圣胡安',
  'Nassau': '拿骚',
  'Kingston': '金斯敦',
  'Santo Domingo': '圣多明各',
  'Panama City': '巴拿马城',
  'San Jose': '圣何塞',
  'Guatemala City': '危地马拉城',
  
  // 俄罗斯城市
  'Moscow': '莫斯科',
  'Saint Petersburg': '圣彼得堡',
  'Novosibirsk': '新西伯利亚',
  'Yekaterinburg': '叶卡捷琳堡',
  'Nizhny Novgorod': '下诺夫哥罗德',
  'Kazan': '喀山',
  'Chelyabinsk': '车里雅宾斯克',
  'Omsk': '鄂木斯克',
  'Samara': '萨马拉',
  'Rostov-on-Don': '顿河畔罗斯托夫',
  'Ufa': '乌法',
  'Krasnoyarsk': '克拉斯诺亚尔斯克',
  'Perm': '彼尔姆',
  'Voronezh': '沃罗涅日',
  'Volgograd': '伏尔加格勒',
  'Vladivostok': '符拉迪沃斯托克',
  'Irkutsk': '伊尔库茨克',
  'Khabarovsk': '哈巴罗夫斯克',
  'Sochi': '索契'
};

// 翻译机场/港口名称
function translateName(name, city, countryCode) {
  // 1. 先检查中国城市拼音对照（针对中国港口）
  if (countryCode === 'CN' && city && chinaCitiesPinyin[city]) {
    return chinaCitiesPinyin[city];
  }
  
  // 2. 检查城市是否有完整翻译
  if (city && cityTranslations[city]) {
    // 如果城市有翻译，尝试组合翻译
    const cityZh = cityTranslations[city];
    
    // 检查是否是简单的 "City Airport" 格式
    if (name === `${city} Airport` || name === `${city} International Airport`) {
      return name.includes('International') ? `${cityZh}国际机场` : `${cityZh}机场`;
    }
    
    // 对于更复杂的名称，进行词汇替换
    let translated = name;
    for (const [en, zh] of Object.entries(commonWords)) {
      const regex = new RegExp(`\\b${en}\\b`, 'gi');
      translated = translated.replace(regex, zh);
    }
    
    // 如果有变化，返回翻译
    if (translated !== name) {
      return translated;
    }
  }
  
  // 3. 检查中国城市拼音（用名称匹配）
  if (countryCode === 'CN' && chinaCitiesPinyin[name]) {
    return chinaCitiesPinyin[name];
  }
  
  // 4. 尝试词汇替换
  let translated = name;
  
  // 先替换中国城市拼音
  for (const [pinyin, zh] of Object.entries(chinaCitiesPinyin)) {
    const regex = new RegExp(`\\b${pinyin}\\b`, 'gi');
    translated = translated.replace(regex, zh);
  }
  
  // 再替换城市名
  for (const [en, zh] of Object.entries(cityTranslations)) {
    const regex = new RegExp(`\\b${en}\\b`, 'gi');
    translated = translated.replace(regex, zh);
  }
  
  // 最后替换常用词
  for (const [en, zh] of Object.entries(commonWords)) {
    const regex = new RegExp(`\\b${en}\\b`, 'gi');
    translated = translated.replace(regex, zh);
  }
  
  // 如果翻译后有变化，返回
  if (translated !== name) {
    return translated;
  }
  
  return null; // 无法翻译
}

// 主函数
async function main() {
  console.log('开始处理机场数据...');
  
  // 读取分类后的机场数据
  const airportsPath = path.join(__dirname, '../public/data/airports-classified.json');
  const airportsData = JSON.parse(fs.readFileSync(airportsPath, 'utf-8'));
  
  let translatedCount = 0;
  let totalCount = 0;
  
  // 遍历所有机场并添加中文名
  for (const continent of Object.values(airportsData.continents)) {
    for (const region of Object.values(continent.regions)) {
      for (const country of Object.values(region.countries)) {
        const countryCode = country.code;
        for (const airport of country.airports) {
          totalCount++;
          const zhName = translateName(airport.name, airport.city, countryCode);
          if (zhName) {
            airport.nameZh = zhName;
            translatedCount++;
          }
        }
      }
    }
  }
  
  console.log(`机场翻译完成: ${translatedCount}/${totalCount}`);
  
  // 保存更新后的数据
  fs.writeFileSync(airportsPath, JSON.stringify(airportsData, null, 2));
  
  // 处理港口数据
  console.log('开始处理港口数据...');
  const portsPath = path.join(__dirname, '../public/data/ports-classified.json');
  const portsData = JSON.parse(fs.readFileSync(portsPath, 'utf-8'));
  
  let portTranslatedCount = 0;
  let portTotalCount = 0;
  
  for (const continent of Object.values(portsData.continents)) {
    for (const region of Object.values(continent.regions)) {
      for (const country of Object.values(region.countries)) {
        const countryCode = country.code;
        for (const port of country.ports) {
          portTotalCount++;
          const zhName = translateName(port.name, port.city, countryCode);
          if (zhName) {
            port.nameZh = zhName;
            portTranslatedCount++;
          }
        }
      }
    }
  }
  
  console.log(`港口翻译完成: ${portTranslatedCount}/${portTotalCount}`);
  
  // 保存更新后的数据
  fs.writeFileSync(portsPath, JSON.stringify(portsData, null, 2));
  
  console.log('翻译完成！');
}

main().catch(console.error);
