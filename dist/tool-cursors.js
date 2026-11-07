import {icon} from './icons.js';
export const TOOL_HINTS={
move:'Drag to move · Shift constrains direction',node:'Click an anchor · Drag to edit · Alt separates handles',
select:'Drag a rectangle · Shift makes a square',ellipse:'Drag an ellipse · Shift makes a circle',
lasso:'Hold and drag a freehand selection · Release to close · Ctrl+D clears',wand:'Click a connected color · Adjust tolerance above',
crop:'Choose a ratio or exact size · Drag a crop · Enter applies · Escape cancels',
brush:'Drag to paint · [ / ] changes size · Ctrl+Z undoes',eraser:'Drag to erase on a pixel layer or mask · [ / ] changes size',
clone:'Alt-click a source · Release Alt and paint · Aligned sampling',heal:'Alt-click clean texture · Paint over the blemish',
dodge:'Paint to brighten · Adjust strength and tonal range above',burn:'Paint to darken · Adjust strength and tonal range above',
pen:'Click for corners · Drag for curves · Click first point to close · Enter finishes',
text:'Click to add text · Double-click existing text to edit',shape:'Drag to draw · Shift keeps equal sides',gradient:'Drag to draw a gradient shape',
eyedropper:'Click to sample the visible color',hand:'Drag to pan · Space temporarily pans',zoom:'Click to zoom in · Alt-click to zoom out'};
const cache=new Map(),paintTools=['brush','eraser','clone','heal','dodge','burn'];
export function toolCursor(tool,{alt=false,drawing=false,close=false}={}) {
 if(tool==='text')return 'text';if(tool==='hand')return drawing?'grabbing':'grab';
 const key=[tool,alt,drawing,close].join(':');if(cache.has(key))return cache.get(key);
 const path=icon(tool).match(/<path[^>]+d="([^"]+)"/)?.[1]||'M4 12h16M12 4v16';
 let content,x=8,y=8;const cross=(cx,cy)=>`<path d="M${cx-4} ${cy}h8M${cx} ${cy-4}v8"/>`;
 if(tool==='pen'){x=7;y=25;content=`<g transform="translate(4 6) scale(.9)"><path d="${path}"/></g>`+cross(x,y)+(close?'<circle cx="31" cy="10" r="4"/>':drawing?cross(31,10):'');}
 else if(paintTools.includes(tool)){x=y=15;content='<circle cx="15" cy="15" r="11"/>'+cross(x,y)+`<g transform="translate(23 23) scale(.56)"><path d="${path}"/></g>`+(alt?'<circle cx="15" cy="15" r="4"/>':'');}
 else if(tool==='move'||tool==='node'){x=tool==='move'?15:6;y=tool==='move'?15:4;content=`<g transform="translate(3 2)"><path d="${path}"/></g>`;}
 else content=cross(x,y)+`<g transform="translate(14 13) scale(.8)"><path d="${path}"/></g>`+(tool==='zoom'&&alt?'<path d="M30 5h8"/>':'');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#10252a" stroke-width="3.5">${content}</g><g stroke="#e4fff6" stroke-width="1.25">${content}</g></svg>`;
 const result=`url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, crosshair`;cache.set(key,result);return result;
}
export function createToolCursors(stage,getState) {
 const contrast=typeof matchMedia==='function'?matchMedia('(forced-colors: active)'):null;let previous='';
 return {update(event={}){const s=getState(),tool=s.space?'hand':s.tool,flags={alt:!!event.altKey,drawing:!!s.drawing,close:!!s.close},cursor=contrast?.matches?(tool==='text'?'text':tool==='hand'?(flags.drawing?'grabbing':'grab'):'crosshair'):toolCursor(tool,flags);stage.dataset.activeTool=tool;if(previous!==cursor){stage.style.setProperty('--luma-tool-cursor',cursor);previous=cursor;}}};
}
