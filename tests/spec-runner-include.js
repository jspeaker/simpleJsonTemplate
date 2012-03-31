var included = new Object();

var include = function (src) {
  if (included[src.toLowerCase()]) {
    console.error("Duplicate include: " + src);
  } else {
    document.writeln('<script type="text/javascript" src="' + src + '"></script>');
    included[src] = true;
  }
};