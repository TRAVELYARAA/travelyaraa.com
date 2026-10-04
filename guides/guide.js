(function(){
  "use strict";
  var box, boxImg, boxText;

  function build(){
    box = document.createElement("dialog");
    box.className = "lightbox";
    box.setAttribute("aria-label", "Full photo");
    box.innerHTML = '<div class="lightbox-inner"><button type="button" class="lightbox-close" aria-label="Close photo">&times;</button><img alt=""><div class="lightbox-text"></div></div>';
    document.body.appendChild(box);
    boxImg = box.querySelector("img");
    boxText = box.querySelector(".lightbox-text");
    box.querySelector(".lightbox-close").addEventListener("click", close);
    box.addEventListener("click", function(e){
      if(e.target === box || e.target.classList.contains("lightbox-inner")) close();
    });
    box.addEventListener("close", function(){ boxImg.removeAttribute("src"); });
  }

  function open(src, alt, captionHtml){
    if(!box) build();
    boxImg.src = src;
    boxImg.alt = alt || "";
    boxText.innerHTML = captionHtml || "";
    if(typeof box.showModal === "function") box.showModal();
    else box.setAttribute("open", "");
  }

  function close(){
    if(typeof box.close === "function") box.close();
    else box.removeAttribute("open");
  }

  document.addEventListener("click", function(e){
    var btn = e.target.closest("[data-full]");
    if(!btn) return;
    e.preventDefault();
    var fig = btn.closest("figure");
    var img = btn.querySelector("img") || (fig && fig.querySelector("img"));
    var cap = fig && fig.querySelector("figcaption");
    open(btn.getAttribute("data-full"), img ? img.alt : "", cap ? cap.innerHTML : "");
  });

  var toc = document.querySelector(".toc");
  if(toc && window.matchMedia && window.matchMedia("(max-width: 960px)").matches) toc.removeAttribute("open");
})();
