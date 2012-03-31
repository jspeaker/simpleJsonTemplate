$.fn.outerHtml = function (s) {
  return s
        ? this.before(s).remove()
        : $("<p>").append(this.eq(0).clone()).html();
};

