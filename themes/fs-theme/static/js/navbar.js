var lastScrollTop = 0;

// element should be replaced with the actual target element on which you have applied scroll, use window in case of no target element.
document.body.addEventListener(
  "scroll",
  function () {
    var st = window.pageYOffset || document.body.scrollTop;
    if (st > lastScrollTop) {
      // downscroll code
      console.log("scroll down");
      document.getElementById("navbar").style.top = "-120px";
    } else {
      document.getElementById("navbar").style.top = "0px";
    }
    lastScrollTop = st <= 0 ? 0 : st; // For Mobile or negative scrolling
  },
  false,
);
