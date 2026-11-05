import {createDocument,createLayer} from './model.js';
export const TEMPLATES = [
  {id:'botanical',name:'Botanical stories',category:'Social',size:'1080 × 1350',width:1080,height:1350,colors:['#ecf1d5','#174d3b','#b6d474']},
  {id:'studio',name:'Objects of desire',category:'Poster',size:'1080 × 1350',width:1080,height:1350,colors:['#f4b5a1','#542b45','#d45235']},
  {id:'editorial',name:'The slow edit',category:'Social',size:'1080 × 1080',width:1080,height:1080,colors:['#e9e1d4','#1c332f','#c8a87e']},
  {id:'night',name:'After hours',category:'Poster',size:'1080 × 1350',width:1080,height:1350,colors:['#23223e','#d1c3ff','#8b6bdd']},
  {id:'story',name:'Something good',category:'Story',size:'1080 × 1920',width:1080,height:1920,colors:['#efe6d1','#9a3b28','#e9ac58']},
  {id:'launch',name:'A fresh perspective',category:'Presentation',size:'1920 × 1080',width:1920,height:1080,colors:['#e0eee9','#174f48','#94c1b2']}
];
export function makeTemplate(id){
  const t=TEMPLATES.find(t=>t.id===id);if(!t)throw new Error('Unknown template.');
  const d=createDocument(t.width,t.height,t.name),W=t.width,H=t.height,[paper,ink,accent]=t.colors;
  const shape=(name,x,y,w,h,color,kind='rect',extra={})=>d.layers.push(createLayer('shape',{name,x,y,width:w,height:h,color,shape:kind,radius:0,...extra}));
  const text=(name,value,x,y,w,size,color=ink,extra={})=>d.layers.push(createLayer('text',{name,text:value,x,y,width:w,height:size*(value.split('\n').length+1)*1.15,font:'Inter',fontSize:size,fontWeight:500,lineHeight:1.03,color,align:'left',...extra}));
  shape('Paper',0,0,W,H,paper,'rect',{locked:true});
  if(id==='botanical'){
    text('Edition','FIELD NOTES     /     VOL. 01',74,76,900,24);
    shape('Green disc',420,340,780,780,accent,'ellipse');
    shape('Stem',724,420,8,870,ink,'rect',{rotation:19});
    for(let i=0;i<5;i++)shape('Leaf '+(i+1),540+(i%2)*150,520+i*114,230,108,i%2?ink:'#6c8c49','ellipse',{rotation:i%2?-39:38});
    text('Headline','A little\ncloser to\nnature.',72,186,900,132,ink,{font:'Georgia',lineHeight:1.01});
    text('Supporting copy','Good things take root.\nMake room for a slower kind of everyday.',76,1124,830,29,ink,{lineHeight:1.5,fontWeight:400});
    shape('Footer rule',76,1250,926,2,ink);text('Footer','GROW AT YOUR OWN PACE',76,1273,820,20);
  }else if(id==='studio'){
    text('Masthead','FORMA / OBJECTS',72,66,900,29,ink,{fontWeight:700});
    text('Edition','A STUDY IN EVERYDAY BEAUTY',72,139,900,19);
    shape('Circle',142,348,800,800,accent,'ellipse');
    shape('Vessel body',320,564,432,520,'#f4dbbd','rect',{radius:96,rotation:-8,effects:{shadow:true,shadowColor:'#7c362a',shadowBlur:50,shadowX:25,shadowY:35}});
    shape('Vessel opening',319,535,432,108,'#542b45','ellipse',{rotation:-8});
    shape('Vessel lip',334,550,402,77,'#b66344','ellipse',{rotation:-8});
    text('Headline','Objects\nof desire.',72,217,950,128,ink,{font:'Georgia',lineHeight:1.03});
    text('Footer','LESS, BUT MORE CONSIDERED.',76,1222,900,22);
    text('Collection','THE NEW COLLECTION / 2026',76,1271,900,19);
  }else if(id==='editorial'){
    shape('Cover panel',50,50,W-100,H-100,'#1c332f');
    shape('Sun',650,128,290,290,accent,'ellipse');
    for(let i=0;i<8;i++)shape('Rhythm '+i,178+i*87,460,38,435,'#d3d5bd','rect',{radius:19,rotation:28});
    text('Masthead','SUNDAY JOURNAL',95,100,850,23,paper);
    text('Headline','The\nslow edit.',90,216,850,133,paper,{font:'Georgia'});
    text('Footer','A NEW PERSPECTIVE ON THE EVERYDAY',95,928,850,19,paper);
  }else if(id==='night'){
    for(let i=5;i>=0;i--)shape('Orbit '+i,180+i*58,365+i*58,750-i*116,750-i*116,i%2?paper:accent,'ellipse');
    text('Eyebrow','THE CREATIVE SESSIONS / 004',72,80,900,23,ink);
    text('Headline','AFTER\nHOURS.',65,184,970,169,ink,{fontWeight:800,lineHeight:.94});
    text('Footer','MAKE SPACE FOR YOUR NEXT IDEA.',75,1181,900,27,ink);
    text('Date','FRIDAY / 18:00 — LATE',75,1253,900,22,ink);
  }else if(id==='story'){
    text('Eyebrow','YOUR DAILY DOSE OF GOOD',76,107,900,26,ink);
    shape('Sun',128,667,824,824,accent,'ellipse');
    shape('Arch',282,775,516,766,ink,'rect',{radius:120});
    shape('Arch light',335,841,410,647,paper,'rect',{radius:110});
    text('Headline','Something\ngood is\nbrewing.',70,247,940,133,ink,{font:'Georgia'});
    text('Footer','SLOW DOWN. SIP. REPEAT.',76,1645,930,27,ink);
    shape('CTA',76,1735,930,90,ink,'rect',{radius:45});
    text('CTA label','MAKE TODAY A LITTLE BETTER',115,1769,850,25,paper,{align:'center'});
  }else{
    shape('Accent',1110,-150,1000,1400,accent,'ellipse');
    shape('Light orb',1300,160,560,560,paper,'ellipse');
    shape('Dark orb',1180,510,420,420,ink,'ellipse');
    text('Eyebrow','LUMA / CREATIVE STUDIO',100,90,1200,28,ink);
    text('Headline','A fresh\nperspective.',90,275,1500,164,ink,{font:'Georgia'});
    text('Subtitle','Make something worth looking at.',100,779,1300,34,ink,{fontWeight:400});
    text('Footer','DESIGNED WITH INTENTION',100,977,1400,23,ink);
  }
  d.activeId=d.layers.find(l=>l.name==='Headline')?.id||d.layers.at(-1).id;
  return d;
}
