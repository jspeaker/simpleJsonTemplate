var simpleTemplate = (function () {
  var renderJson = function (url, data, target, callback) {
    var template = templateCache.template(url);
    if (template != null) {
      $(target).html(templateController.renderTemplate(template, data));
      if (callback)
        callback();
      return;
    }

    $.ajax({
      async: false,
      cache: true,
      dataType: "html",
      type: "GET",
      url: url,
      success: function (result) {
        templateCache.add(url, result);
        $(target).html(templateController.renderTemplate(result, data));
        if (callback)
          callback();
      },
      error: function (xhr) {
        if (xhr.statusMessage != "error") {
          templateCache.add(url, xhr.responseText);
          $(target).html(templateController.renderTemplate(xhr.responseText, data));
          if (callback)
            callback();
          return;
        }
        $(target).html("Template " + url + " could not be loaded.");
      }
    });
  };

  return {
    renderJson: function (url, data, target, callback) {
      renderJson(url, data, target, callback);
    }
  };
})();

var templateController = (function () {
  var propertyTypes = {
    encoded: {
      key: "encoded",
      pattern: "\\$(\\{)([^\\{])*(\\})",
      specifier: "$"
    },
    script: {
      key: "script",
      pattern: "\\!(\\{)([^\\{])*(\\})\\!",
      specifier: "!"
    }
  };

  var renderProperties = function (propertyType, element, data, itemName) {
    var pattern = propertyType.pattern;
    var regEx = new RegExp(pattern, "g");
    var theHtml = element.outerHtml();
    var properties = theHtml.match(regEx);
    if (properties == null) {
      element = $(theHtml);
      return element;
    }

    for (var i = 0; i < properties.length; i++) {
      var propertyNameIsolator = new RegExp(/[\$\{\}]/gi);
      var propertyName = properties[i].replace(propertyNameIsolator, "").replace(itemName, "");

      var value;
      try {
        value = eval("data." + propertyName);
      } catch (ex) {
        value = null;
      }

      var replaceRegex = new RegExp(properties[i].replace("$", "\\$").replace("{", "\\{").replace("}", "\\}").replace("[", "\\[").replace("]", "\\]"), "g");
      if (value !== undefined && value !== null) {
        theHtml = theHtml.replace(replaceRegex, decodeURIComponent(value));
      }
    }

    element = $(theHtml);
    return element;
  };

  var renderScript = function (dom, data) {
    var regEx = new RegExp(propertyTypes.script.pattern, "g");
    var theHtml = dom.outerHtml();
    var scriptCalls = theHtml.match(regEx);
    if (scriptCalls == null) {
      dom = $(theHtml);
      return dom;
    }

    for (var i = 0; i < scriptCalls.length; i++) {
      var scriptCall = scriptCalls[i].replace("!{", "").replace("}!", "");
      var value;
      try {
        value = eval(scriptCall);
      } catch (ex) {
        value = null;
      }
      if (value === undefined || value === null) {
        value = "";
      }

      theHtml = theHtml.replace(scriptCalls[i], value);
    }

    dom = $(theHtml);
    return dom;
  };

  var renderEncodedProperties = function (dom, data) {
    return renderProperties(propertyTypes.encoded, dom, data, "");
  };

  var renderCollections = function (dom, data) {
    var collection = dom.find("*[data-foreach][data-in],*[foreach][in]");

    for (var i = 0; i < collection.length; i++) {
      var element = $(collection[i]);

      var collectionName = element.data("in");
      if (collectionName === undefined)
        collectionName = element.attr("in");

      var itemName = element.data("foreach");
      if (itemName === undefined)
        itemName = element.attr("foreach");

      var step = element.data("step");
      if (step === undefined)
        step = element.attr("step");
      if (step === undefined)
        step = 1;

      var collectionData = eval("data." + collectionName);

      if (collectionData !== undefined) {
        var pageSize = element.data("pagesize");
        if (pageSize === undefined) {
          pageSize = element.attr("pagesize");
        }
        if (pageSize === undefined) {
          pageSize = collectionData.length;
        }

        if (data.Page === undefined || data.Page === null) {
          data.Page = 1;
        }

        var startIndex = (pageSize !== collectionData.length ? data.Page * pageSize : pageSize) - pageSize;
        var lastIndex = pageSize < collectionData.length ? (pageSize * data.Page) - 1 : collectionData.length - 1;
        if (lastIndex > collectionData.length - 1)
          lastIndex = collectionData.length - 1;

        for (var j = startIndex; j <= lastIndex; j = j + step) {
          var newElement = element.clone();
          handleItemConditions(newElement, collectionData[j]);
          newElement.removeAttr("data-foreach").removeAttr("data-in").removeAttr("foreach").removeAttr("in");
          newElement = renderProperties(propertyTypes.encoded, newElement, collectionData[j], itemName + ".");
          newElement = renderCollections(newElement, collectionData[j]);
          element.parent().append(newElement);
        }
        cleanupItemConditions(element.parent());
        element.remove();
      }
    }
    return dom;
  };

  var cleanupItemConditions = function (dom) {
    var conditions = dom.find("*[data-if-item],*[if-item]");
    for (var i = 0; i < conditions.length; i++) {
      $(conditions[i]).removeAttr("data-if-item").removeAttr("if-item");
    }
  };

  var handleItemConditions = function (dom, data) {
    var conditions = dom.find("*[data-if-item],*[if-item]");
    for (var i = 0; i < conditions.length; i++) {
      var condition = $(conditions[i]).data("if-item");
      if (condition === undefined)
        condition = $(conditions[i]).attr("if-item");

      try {
        if (!evalInContext(condition, data)) {
          $(conditions[i]).remove();
        }
      } catch (ex) { }
    }
    return dom;
  };

  var handleConditions = function (dom, data) {
    var conditions = dom.find("*[data-if],*[if]");
    for (var i = 0; i < conditions.length; i++) {
      var condition = $(conditions[i]).data("if");
      if (condition === undefined)
        condition = $(conditions[i]).attr("if");

      if (!evalInContext(condition, data)) {
        $(conditions[i]).remove();
      }
      $(conditions[i]).removeAttr("data-if").removeAttr("if");
    }
    return dom;
  };

  var evalInContext = function (code, context) {
    for (var varName in context) {
      var setContextVar = "var " + varName + " = context." + varName + ";\r\n";
      eval(setContextVar);
    }
    return eval(code);
  };

  var renderTemplate = function (template, data) {
    // prevent template from firing potential 404s by attempting to load resources when initially added to dom
    template = template.replace(/ src\=/gi, " src_temp_disabled=");

    var dom = $(template);
    dom = handleConditions(dom, data);
    dom = renderEncodedProperties(dom, data);
    dom = renderCollections(dom, data);

    dom = renderScript(dom, data);

    dom = $(dom.outerHtml().replace(/src_temp_disabled\=/gi, " src="));

    dom = $(dom.outerHtml().replace(/\$(\{)([^\{])*(\})/gi, String.empty));

    return dom.outerHtml();
  };

  return {
    renderTemplate: function (template, data) {
      return renderTemplate(template, data);
    }
  };
})();

var conditionManager = (function () {
  var parse = function (condition) {
    return condition.replace(/\#/g, "data.");
  };

  return {
    parse: function (condition) {
      return parse(condition);
    }
  };
})();

var templateCache = (function () {
  var cache = [];

  var clear = function () {
    cache = [];
  };

  var add = function (key, value) {
    cache.push({ key: key, value: value });
  };

  var template = function (key) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].key == key)
        return cache[i].value;
    }
    return null;
  };

  var exists = function (key) {
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].key == key)
        return true;
    }
    return false;
  };

  return {
    add: function (key, value) {
      if (!exists(key))
        return add(key, value);
      return false;
    },
    template: function (key) {
      return template(key);
    },
    count: function () {
      return cache.length;
    },
    clear: function () {
      clear();
    }
  };
})();
