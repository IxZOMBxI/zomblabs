// Product identity and campaign phrases are drawn from the existing RADIO artwork.
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;};
const link=(text,url)=>{const a=el('a',text);a.href=url;return a;};
const brands=[
 {id:'crypt-crunch',name:'Crypt Crunch',category:'Snacks',eyebrow:'CRYPT-STYLE CRUNCH SNACKS',headline:'Sinfully crunchy.',intro:'The snack that raises the dead… hungry. Bold mutant seasoning. A crunch with a wicked streak.',tagline:'RAISE YOUR SNACK GAME',page:'the-crunch',pageTitle:'Inside the crunch',detailTitle:'Big crunch. Bold character.',detail:'Meet the purple pack with the radioactive flavor blend. Crypt Crunch brings its loudest personality to every part of the snack: the crunch, the seasoning and the unmistakable bag.',features:[['01','Crypt-style crunch','A snack with a bite and a name you won’t forget.'],['02','Bold mutant seasoning','Big flavor language. Absolutely no quiet packaging.'],['03','Radioactive flavor blend','The signature blend named on the Crypt Crunch pack.']],closing:'Not a snack for the background.',cta:'Meet the crunch'},
 {id:'dead-air',name:'Dead Air',category:'Communication devices',eyebrow:'DEAD AIR / DA-100',headline:'The device. Up close.',intro:'Meet Dead Air: a portable communication device with a distinctive front-panel display, physical controls and an integrated carry handle.',tagline:'DA-100 / DEVICE OVERVIEW',page:'da-100',pageTitle:'Device details',detailTitle:'Designed around the controls.',detail:'Explore the DA-100 shown in the original campaign: a prominent speaker grille, illuminated display, antenna and dedicated front-panel controls. A closer look at the device, from its carry handle to its labeled interface.',features:[['01','Physical controls','Mode and Output knobs sit below the display, with PWR, BATT and EXT labels along the lower panel.'],['02','At-a-glance display','The campaign image shows Mode, Level and battery indicators together on the front display.'],['03','Portable form','An integrated carry handle, antenna and protective outer frame define the illustrated DA-100.']],closing:'Get to know the DA-100.',cta:'View device details'},
 {id:'grim-glow',name:'Grim Glow',category:'Drinks',eyebrow:'LUMINOUS CITRUS TONIC',headline:'Glows going down.',intro:'Citrus with a darker side. A luminous green tonic, a gothic silhouette, and a glow that refuses to blend in.',tagline:'A LITTLE DARKNESS. A LOT OF GLOW.',page:'the-tonic',pageTitle:'Discover the tonic',detailTitle:'Citrus in the spotlight.',detail:'Meet Grim Glow: luminous citrus tonic in its signature bottle. Electric green meets deep violet in a drink with a distinctly after-dark personality.',features:[['I','Luminous citrus','The citrus tonic at the heart of Grim Glow.'],['II','High-octane energy','The energy-forward character of the original campaign.'],['III','Vitamin infusion','Part of the tonic’s campaign identity, paired with its unmistakable glow.']],closing:'Let the night glow.',cta:'Discover the tonic'}
];
function mountBrand(brand,detail) {return container=>{
 const root=el('div',null,'advertiser-site');
 const header=el('header',null,'ad-header');header.append(link(brand.name,'zomb://'+brand.id));const nav=el('nav');nav.setAttribute('aria-label',brand.name+' navigation');
 nav.append(link('Home','zomb://'+brand.id),link(brand.pageTitle,'zomb://'+brand.id+'/'+brand.page),link('Directory','zomb://directory'));header.append(nav);root.append(header);
 const hero=el('section',null,'ad-hero');const copy=el('div',null,'ad-copy');copy.append(el('p',brand.eyebrow,'ad-eyebrow'),el('h1',detail?brand.detailTitle:brand.headline),el('p',detail?brand.detail:brand.intro));copy.append(link(detail?'Back to '+brand.name:brand.cta,'zomb://'+brand.id+(detail?'':'/'+brand.page)));
 const figure=el('figure',null,'ad-art');const img=el('img');img.src='media/artwork/'+encodeURIComponent(brand.name)+'.png';img.alt=brand.name+' original RADIO campaign artwork';img.width=1254;img.height=1254;img.decoding='async';figure.append(img);hero.append(copy,figure);root.append(hero);
 root.append(el('p',brand.tagline,'ad-strip'));
 const features=el('section',null,'ad-features');features.setAttribute('aria-label','Product highlights');
 for(const [number,title,text] of brand.features){const card=el('article');card.append(el('span',number,'ad-number'),el('h2',title),el('p',text));features.append(card);}root.append(features);
 if(brand.id==='dead-air') {
  const technical=el('section',null,'ad-device-details');technical.append(el('h2','Device reference'),el('p','DA-100 · Communication device'));
  const facts=el('dl');
  for(const [label,value] of [['Model marking','DA-100'],['Front controls','Mode and Output knobs'],['Panel labels','PWR · BATT · EXT'],['Display labels','Mode · Level · Battery'],['Visible construction','Carry handle, antenna, speaker grille and protective frame']]) {facts.append(el('dt',label),el('dd',value));}
  technical.append(facts);root.append(technical);
 }
 if(detail){const campaign=el('section',null,'ad-campaign');campaign.append(el('h2','The campaign'),el('p',brand.name+' — '+brand.eyebrow.toLowerCase()+'.'),el('p','Explore the original artwork above for the product’s campaign presentation.'));
 const disclosure=el('details');disclosure.append(el('summary','View campaign artwork at full width'));const poster=img.cloneNode();poster.loading='lazy';disclosure.append(poster);campaign.append(disclosure);root.append(campaign);}
 else {const closing=el('section',null,'ad-closing');closing.append(el('h2',brand.closing),link(brand.pageTitle,'zomb://'+brand.id+'/'+brand.page));root.append(closing);}
 const footer=el('footer');footer.append(el('strong',brand.name),el('p','Fictional advertiser presentation. No products, orders or purchases are offered here.'),link('ZombNET directory','zomb://directory'));root.append(footer);container.append(root);
};}
export const advertiserPages=brands.flatMap(brand=>[
 {url:'zomb://'+brand.id,title:brand.name,description:brand.eyebrow,category:brand.category,layout:brand.id,advertiser:true,listed:true,featured:true,mount:mountBrand(brand,false)},
 {url:'zomb://'+brand.id+'/'+brand.page,title:brand.name+' — '+brand.pageTitle,layout:brand.id,advertiser:true,listed:false,mount:mountBrand(brand,true)}
]);
