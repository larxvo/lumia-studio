'use strict';
function resolveLanguage(preferred,choice='auto') {
  if(choice==='vi'||choice==='en')return choice;
  for(const value of preferred||[]){const language=String(value).toLowerCase().split(/[-_]/)[0];if(language==='vi'||language==='en')return language;}
  return 'en';
}
module.exports={resolveLanguage};
