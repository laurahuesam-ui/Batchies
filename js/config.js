const STORAGE_KEY='batchies_product_dev_v1';
const defaultState={settings:{listingFee:.18,transactionPct:6.5,paymentPct:4,paymentFixed:.30,offsitePct:15,currencyPct:2.5,feeVatPct:0,setupFee:0,setupSales:100},products:[],batches:[],counters:{product:0,batch:0},categoryLearning:{}};
const CATEGORY_TREE={
  'Geschenke':['Geschenksets','Personalisierte Geschenke','Kleine Geschenke','Anlässe & Feiern'],
  'Wohnen & Deko':['Kerzen & Düfte','Dekoration','Aufbewahrung','Textilien'],
  'Küche & Trinken':['Tassen & Becher','Gläser & Flaschen','Küchenhelfer','Vorrat & Aufbewahrung'],
  'Garten':['Anzucht & Saatgut','Pflanzenzubehör','Gartendeko','Gartenhelfer'],
  'Papeterie':['Karten','Notizbücher & Planer','Sticker & Etiketten','Schreibwaren'],
  'Schmuck':['Halsketten','Armbänder','Ringe','Ohrringe'],
  'Accessoires':['Taschen & Beutel','Schlüsselanhänger','Haarschmuck','Sonstige Accessoires'],
  'Beauty & Wellness':['Pflege','Badeprodukte','Wellness-Sets','Kosmetikzubehör'],
  'Mode':['Shirts & Tops','Pullover & Hoodies','Socken','Sonstige Kleidung'],
  'Tierbedarf':['Hund','Katze','Pferd','Sonstige Tiere'],
  'Kinder & Baby':['Baby','Kinderzimmer','Spiel & Lernen','Accessoires'],
  'Saison & Feiertage':['Weihnachten','Ostern','Halloween','Hochzeit'],
  'Basteln & DIY':['Bastelmaterial','DIY-Sets','Werkzeuge & Zubehör','Rohlinge'],
  'Verpackung':['Boxen & Kartons','Tüten & Beutel','Füllmaterial','Bänder & Etiketten'],
  'Sonstiges':['Allgemein']
};
const CATEGORY_RULES=[
 ['Geschenke','Geschenksets',['geschenkset','geschenk box','geschenkbox','gift set','gift box','präsentkorb','praesentkorb','set']],
 ['Wohnen & Deko','Kerzen & Düfte',['kerze','duftkerze','candle','wax melt','duftwachs']],
 ['Küche & Trinken','Tassen & Becher',['tasse','becher','mug','kaffeebecher']],
 ['Küche & Trinken','Gläser & Flaschen',['glas','trinkglas','flasche','bottle','thermobecher']],
 ['Garten','Anzucht & Saatgut',['saatgut','samen','seed','anzucht','pflanzset','pflanz set']],
 ['Garten','Pflanzenzubehör',['pflanzenclip','tomatenclip','pflanzschild','blumentopf','pflanztopf','garten']],
 ['Papeterie','Karten',['grußkarte','grusskarte','karte','postkarte','card']],
 ['Papeterie','Notizbücher & Planer',['notizbuch','journal','planer','planner','notebook']],
 ['Papeterie','Sticker & Etiketten',['sticker','aufkleber','etikett','label']],
 ['Schmuck','Halsketten',['halskette','kette','necklace','anhänger','anhaenger']],
 ['Schmuck','Armbänder',['armband','bracelet']], ['Schmuck','Ringe',['ring']], ['Schmuck','Ohrringe',['ohrring','earring']],
 ['Accessoires','Taschen & Beutel',['tasche','beutel','tote bag','bag']], ['Accessoires','Schlüsselanhänger',['schlüsselanhänger','schluesselanhaenger','keychain']],
 ['Beauty & Wellness','Badeprodukte',['badesalz','badekugel','bath bomb','seife','soap']], ['Beauty & Wellness','Pflege',['pflege','creme','lippenbalsam','balm']],
 ['Mode','Shirts & Tops',['shirt','t-shirt','tshirt','top']], ['Mode','Pullover & Hoodies',['hoodie','pullover','sweatshirt']],
 ['Tierbedarf','Pferd',['pferd','horse','halfter','trense','stall']], ['Tierbedarf','Hund',['hund','dog','hundehalsband']], ['Tierbedarf','Katze',['katze','cat']],
 ['Saison & Feiertage','Weihnachten',['weihnacht','christmas','advent']], ['Saison & Feiertage','Ostern',['ostern','easter']], ['Saison & Feiertage','Hochzeit',['hochzeit','wedding','braut']],
 ['Basteln & DIY','Rohlinge',['rohling','blank','sublimation']], ['Verpackung','Boxen & Kartons',['karton','box','schachtel','verpackungsbox']], ['Verpackung','Tüten & Beutel',['tüte','tuete','versandtasche','cellophanbeutel']]
];
