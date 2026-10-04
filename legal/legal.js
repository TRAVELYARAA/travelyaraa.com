(function(){
  "use strict";
  var back = document.querySelector("[data-back]");
  if(!back) return;
  back.addEventListener("click", function(e){
    var ref = document.referrer, sameSite = false;
    try{
      var u = new URL(ref);
      sameSite = u.origin === location.origin && u.href !== location.href;
    }catch(_){}
    if(sameSite && history.length > 1){
      e.preventDefault();
      history.back();
    }
  });
})();
