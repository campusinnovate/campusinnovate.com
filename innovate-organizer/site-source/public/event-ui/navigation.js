'use strict';
document.addEventListener('click', function(event) {
  const target=event.target instanceof Element?event.target:null;
  document.querySelectorAll('.portal-menu[open]').forEach(menu=>{
    if(!target||!menu.contains(target)||target.closest('a[href]'))menu.removeAttribute('open');
  });
});
document.addEventListener('keydown',function(event){
  if(event.key!=='Escape')return;
  document.querySelectorAll('.portal-menu[open]').forEach(menu=>{menu.removeAttribute('open');menu.querySelector('summary')?.focus();});
});
