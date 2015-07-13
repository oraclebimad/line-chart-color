(function (main) {
  'use strict';
  /* jshint unused:true, jquery:true, curly:false, browser:true */
  var formats = {
    raw: function () {
      var decimals = d3.format('.2f');
      var integers = d3.format('');
      return function (value) {
        return (value + '').split('.').length > 1 ? decimals(value) : integers(value);
      };
    },
    currency: function (opts) {
      opts = Utils.isObject(opts) ? opts : {};
      if (!opts.symbol)
        opts.symbol = '$';
      var format = formats.thousands(opts);
      return function (value) {
        return opts.symbol + ' ' + format(value);
      };
    },
    thousands: function (opts) {
      var format = ',';
      opts = Utils.isObject(opts) ? opts : {};
      if (opts.decimals)
        format += '.2';
      if (opts.si)
        format += 's';
      format += 'f';
      return d3.format(format);
    },
    axis: function (formatter) {
      if (!formatter || typeof formatter !== 'function')
        formatter = String;

      var suffixFormatter = d3.format('s');
      return function (value) {
        //Remove all non integer values
        value = parseInt(value, 10);
        var formatted = suffixFormatter(value);
        var suffix = formatted.replace(/\d+/, '');
        value = formatted.replace(/[^\d]+/, '');
        return formatter(value) + suffix;
      };
    }
  };
  var Utils = {
    isDesigner: function () {
      return xdo && xdo.app && xdo.app.designer && xdo.app.designer.DesignerApplication;
    },
    proxy: function (fn, thisArg) {
      return function () {
        return fn.apply(thisArg, Utils.toArray(arguments));
      };
    },
    toArray: function (obj) {
      return Array.prototype.slice.call(obj);
    },
    stringToBoolean: function(obj){
      return typeof obj === 'boolean' ? obj : obj.toLowerCase() === "true";
    },
    deferred: jQuery.Deferred,
    pluck: function (data, key) {
      var values = [];
      if (Utils.isArray(data)) {
        values = data.map(function (value) {
          return value[key];
        });

        values = values.filter(function (value) {
          return typeof value !== 'undefined' && value !== null;
        });
      }
      return values;
    },
    isObject: function (obj) {
      return jQuery.isPlainObject(obj);
    },
    isFunction: function (method) {
      return typeof method === 'function';
    },
    format: function (format, opts) {
      if (!(format in formats))
        format = 'raw';
      return formats[format](opts);
    },
    capitalize: function (text) {
      return (text + '').toLowerCase().replace(/_/g, ' ');
    },
    ascending: function (a, b) {
      if (!isNaN(a) && !isNaN(b))
        return d3.ascending(+a, +b);
      return (a + '').localeCompare(b);
    },
    descending: function (a, b) {
      if (!isNaN(a) && !isNaN(b))
        return d3.descending(+a, +b);
      return (b + '').localeCompare(a);
    },
    isEmptyObject: jQuery.isEmptyObject,
    isArray: jQuery.isArray,
    extend: jQuery.extend
  };

  if ('Utils' in main)
    Utils = Utils.extend(Utils, main.Utils);

  main.Utils = Utils;
})(this);
;(function (main) {
  'use strict';
  /* jshint unused:true, jquery:true, curly:false */
  /* global Utils */

  function getFieldName (field) {
    var last;
    var name = '';
    if (typeof field === 'string') {
      field = field.slice(field.lastIndexOf('/') + 1);
      last = field.indexOf(':');
      last = last > 0 ? last + 1 : field.length;
      name = field.slice(0, last);
    }
    return name;
  }

  var Parser = {
    date: function (data) {
      var date = new Date(data);
      var year = date.getFullYear().toString();
      var month = date.getMonth().toString();
      return {
        date: date,
        year: year,
        month: month,
        yearmonth: year + month
      };
    },
    parse: function (data) {
      return data;
    }
  };

  var Postprocessors = {
    date: function (node, index, length, meta) {
      //extend the object by parsing the date
      var date;
      var month = 0;
      var day = 1;
      if (meta.aggregate === 'year') {
        date = new Date(node.key, month, day);
      } else if(meta.aggregate === 'yearmonth') {
        month = (length - 1) === index ? 11 : node.key.substring(4);
        day = (length - 1) === index ? 31 : 1;
        date = new Date(node.key.substring(0, 4), node.key.substring(4), day);
      }
      node[meta.name] = date;
    }
  };


  /**
   * Creates a new data model to manipulate the data
   * @param data Array Array of arrays
   * @param metadata Array Column metadata
   */
  var DataModel = function (data, metadata) {
     if (Utils.isArray(data))
       this.setData(data);

     if (Utils.isArray(metadata))
       this.setColumnMetadata(metadata);

     this.sort = {
       by: null,
       comparator: d3.descending
     };
     this.aggregators = {};
     this.columnOrder = [];
  };

  /**
   * Sets the column metadata. This information is given as a parameter to the BIMAD Plugin
   * @param metadata Array Column metadata
   * @return DataModel
   */
  DataModel.prototype.setColumnMetadata = function (meta) {
    var metaData = {};
    var numericColumns = [];
    var columns = [];
    meta.forEach(function (column) {
      var field = column.field;
      var last;
      metaData[column.name] = column;
      if (typeof column.label === 'undefined')
        column.label = getFieldName(column.field);

      column.parser = (column.dataType in Parser) ? column.dataType : 'parse';
      columns.push(column.name);
      if (column.fieldType === 'measure')
        numericColumns.push(column.name);
    });
    this.numericColumns = numericColumns;
    this.metaData = meta;
    this.indexedMetaData = metaData;
    this.columns = columns;
    this.doAggregate = true;
    return this;
  };

  /**
   * Sets the data to work on
   * @param data Array
   * @return DataModel
   */
  DataModel.prototype.setData = function (data) {
    this.data = data;
    return this;
  };

  /**
   * Indexes the data with the column metadata information
   * @return DataModel
   */
  DataModel.prototype.indexColumns = function () {
    var indexed = [];
    var columns = this.columns;
    var metadata = this.indexedMetaData;
    this.data.forEach(function (row) {
      var indexedRow = {};
      row.forEach(function (value, index) {
        var name = columns[index];
        var type = metadata[name].parser;
        indexedRow[name] = value;
        indexedRow[name + '_parsed'] = Parser[metadata[name].parser](value);
      });
      indexed.push(indexedRow);
    });
    this.indexedData = indexed;
    return this;
  };

  /**
   * Sets the colum order to create the hierarchical object.
   * All numeric columns will be discarded and placed at the end of the hierarchy.
   * If second argument is specified as false the nest method will only include the fields specified on the columns parameter
   * If second argument is missing or true, then the hierarchical data will include first the columns specified, and then the
   * rest of te string columns.
   * @param columns Array
   * @param nestExtras Boolean Default true, will include extra string columns in the hierarchy
   * @returns DataModel
   */
  DataModel.prototype.setColumnOrder = function (columns, nestExtras) {
    nestExtras = typeof nestExtras === 'boolean' ? nestExtras : true;
    var columnOrder = [];
    var extraColumns = nestExtras ? this.metaData.slice() : [];
    if (!Utils.isArray(columns))
      columns = [];

    if (columns.length > 0) {
      // first add the string columns that come in the ordered array
      columns.forEach(function (column) {
        if (column in this.indexedMetaData && this.indexedMetaData[column].fieldType !== 'measure')
          columnOrder.push(column);
      }, this);
      //Then add any missing string columns to the end of the array
      extraColumns.forEach(function (column) {
        if (columns.indexOf(column.name) === -1 && column.fieldType !== 'measure')
          columnOrder.push(column.name);
      });
    }
    this.columnOrder = columnOrder;
    return this;
  };

  /**
   * Sets the sorting method by keys
   * @returns DataModel
   */
  DataModel.prototype.sortBy = function (key) {
    if (key in this.indexedMetaData)
      this.sort.by = key;
    return this;
  };

  /**
   * Sets the comparator method to ascending
   * @returns DataModel
   */
  DataModel.prototype.asc = function () {
    this.sort.comparator = Utils.ascending;
    return this;
  };

  /**
   * Sets the sorting method descending
   * @returns DataModel
   */
  DataModel.prototype.desc = function () {
    this.sort.comparator = Utils.descending;
    return this;
  };

  /**
   * Creates the hierarchical object based on the column order
   * @return Object
   */
  DataModel.prototype.nest = function () {
    var aggregators = this.aggregators;
    var meta = this.indexedMetaData;
    var nest = d3.nest();
    var rollups = {};
    var columnTypes = [];
    var root = {
      key: 'root',
    };
    var nested;

    this.columnOrder.forEach(function (column) {
      var columnMeta = meta[column];
      var aggregator = aggregators[columnMeta.dataType];
      columnTypes.push(columnMeta);
      nest.key(function (node) {
        return aggregator ? aggregator(node, column) : node[column];
      });
    });

    if (this.doAggregate) {
      //Create this object dinamically based on the numeric columns
      this.numericColumns.forEach(function (column) {
        rollups[column] = function (leaves) {
          return d3.sum(leaves, function (node) { return node[column]; });
        };
      });

      nest.rollup(function (leaves) {
        var rollup = {};
        for (var key in rollups)
          rollup[key] = rollups[key](leaves);

        return rollup;
      });
    }

    nested = nest.entries(this.indexedData);

    root.values = nested;
    this.numericColumns.forEach(function (column) {
      accumulate(root, column);
    });
    postProcess(root, columnTypes);

    if (this.sort.by)
      sort(root.values, this.sort.by, this.sort.comparator);

    return root;
  };

  DataModel.prototype.aggregate = function (aggregate) {
    if (typeof aggregate === 'undefined')
      return this.doAggregate;

    this.doAggregate = typeof aggregate === 'boolean' ? aggregate : !!aggregate;
    return this;
  };

  DataModel.prototype.dateGroupBy = function (aggregate) {
    var aggregators = {'year': true, 'month': true, 'yearmonth': true};
    var key;
    var column;
    if (!(aggregate in aggregators))
      aggregate = 'year';

    for (key in this.indexedMetaData) {
      column = this.indexedMetaData[key];
      if (column.dataType === 'date')
        column.aggregate = aggregate;
    }
    //create the aggregator and store it for later use
    this.aggregators.date = function (data, column) {
      return data[column + '_parsed'][aggregate];
    };

    return this;
  };

  function sort (data, key, order) {
    if (!Utils.isArray(data))
      return false;

    if (typeof order !== 'function')
      order = Utils.descending;

    data.sort(function (nodeA, nodeB) {
      return order(nodeA[key], nodeB[key]);
    });

    //means we have a hierarchical data of more than one level of depth
    if (Utils.isArray(data[0].values)) {
      data.forEach(function (node) {
        sort(node.values, key, order);
      });
    }

    return true;
  }

  function accumulate (node, key) {
    if (Utils.isObject(node) && !Utils.isEmptyObject(node)) {
      return (Utils.isArray(node.values)) ?
        node[key] = node.values.reduce(function (prev, value) {
          return prev + accumulate(value, key);
        }, 0) :
        node[key] = node.values ? node.values[key] : node[key];
    }
  }

  function postProcess (data, columns) {
    if (data.values && Utils.isArray(data.values)) {
      var valuesLength = data.values.length;
      var column = columns.shift();
      data.values.forEach(function (node, index) {
        if (column && column.dataType in Postprocessors)
          Postprocessors[column.dataType](node, index, valuesLength, column);
        postProcess(node, columns);
      });
    } else if (data.values) {
      delete data.values;
    }
  }

  if (!('Utils' in main))
    main.Utils = {};

  if (!('DataModel' in main.Utils))
    main.Utils.DataModel = DataModel;

})(this);
;(function (main) {
  /* jshint unused:true, jquery:true, curly:false, browser:true */
  /* global d3 */
  /* global utils */
  /* global ColorScale */
  'use strict';

  var arrayMap = Array.prototype.map;

  function calculateDepth (data, depth) {
    if (Utils.isArray(data) && Utils.isObject(data[0])) {
      depth++;
      if (Utils.isArray(data[0].values)) depth = calculateDepth(data[0].values, depth);
    }
    return depth;
  }

  function scrollTween (scrollTop) {
    return function () {
      var i = d3.interpolateNumber(this.scrollTop, scrollTop);
      return function (t) { this.scrollTop = i(t); };
    };
  }

  function sortData (data) {
    if (!Utils.isArray(data.values))
      return false;

    data.values.sort(function (a, b) {
      return b.size - a.size;
    });
    data.values.forEach(function (node, position) {
      node.__x__ = position;
      sortData(node);
    });

    return true;
  }

  var LineChart = function (container, data, opts) {
    this.container = d3.select(container);
    opts = jQuery.isPlainObject(opts) ? opts : {};
    this.options = jQuery.extend({}, LineChart.DEFAULTS, opts);
    this.animations = false;
    this.init();

    if (jQuery.isPlainObject(data) && !jQuery.isEmptyObject(data)) {
      this.setData(data);
    }

    //hide dom filters
    var filter = container.parentNode.querySelector('.filterinfo');
    if (filter)
      filter.style.display = 'none';
  };

  LineChart.key = function (data) {
    return data.key;
  };

  LineChart.hasChildren = function (data) {
    return data.values && Utils.isArray(data.values);
  };

  LineChart.DEFAULTS = {
    width: 400,
    height: 300,
    margin: {top: 5, left: 5, bottom: 0, right: 5},
    colors: ['#f7fbff', '#deebf7', '#c6dbef'],
    padding: {
       top: 0,
       right: 5,
       bottom: 0,
       left: 5
    },
    colorProperty: 'color',
    sizeFormat: 'currency',
    'background-color': '#F1F5F8'

  };

  LineChart.prototype.init = function () {
    var self = this;
    var visContainer;
    this.options.width = parseInt(this.options.width, 10);
    this.options.height = parseInt(this.options.height, 10);
    this.levelsRendered = 0;
    this.events = {
      'filter': [],
      'remove-filter': []
    };

    this.filters = {};

    this.legends = this.container.append('div').attr('class', 'line-chart-legends');

    this.barContainer = this.container.append('div');

    this.barContainer.attr({
      'class': 'line-chart-container no-animation'
    }).style({
      'background-color': this.options['background-color'],
      'padding-top': this.options.padding.top + 'px',
      'padding-bottom': this.options.padding.bottom + 'px',
      'height': this.options.height + 'px',
      'width' : this.options.widht + 'px'
    });


    this.setColors(this.options.colors);
    this.scale = d3.scale.linear();
    this.scale.clamp(true).range([1, 100]);

    this.barContainer.node().addEventListener('click', function (event) {
      var target = $(event.target || event.srcElement);
      var selector = 'div.line-container';
      var line = target.is(selector) ? target : target.parents(selector);

      if (line.length)
        self.toggleSelect(line[0]);
    });
  };

  LineChart.prototype.setData = function (data) {
    this.depth = 0;
    if (!this.unfilteredData)
      this.unfilteredData = data;

    this.data = data;
    //order data
    sortData(data);
    this.depth = calculateDepth(this.data.values, this.depth);
    return this;
  };

  LineChart.prototype.setColors = function (colors) {
    this.colorScale = d3.scale.threshold();
    this.colorScale.range(colors);
    if (isNaN(this.options.threshold))
      this.setColorDomain();
    else
      this.colorScale.domain([this.options.threshold]);
    return this;
  };

  LineChart.prototype.setColorDomain = function () {
    var domain = [];
    var length = this.colorScale.range().length;
    var step = 1 / length;
    for (var i = 1; i < length; i++) {
      domain.push(i * step);
    }
    this.colorScale.domain(domain);
    return this;
  };

  LineChart.prototype.adjustColorDomain = function (data) {
    if (isNaN(this.options.threshold))
      this.colorScale.max = d3.max(Utils.pluck(data, this.options.colorProperty));
    return this;
  };

  LineChart.prototype.getColor = function (scale, color) {
    var max;
    var fraction = color;
    if (isNaN(this.options.threshold)) {
      max = this[scale].max;
      fraction = color > 0 ? color / max : 0;
    }
    return this[scale](fraction);
  };

  LineChart.prototype.animate = function (animate) {
    if (arguments.length) {
      this.animations = !!animate;
      return this;
    }

    return this.animations;
  };

  LineChart.prototype.adjustScale = function (data) {
    this.scale.domain([0, d3.max(Utils.pluck(data, 'size'))]);
    return this;
  };

  LineChart.prototype.toggleSelect = function (line) {
    var data;
    var isSelected;
    var container = d3.select(line.parentNode);
    var hasChildren;
    line = d3.select(line);
    data = line.node().__data__;
    hasChildren = LineChart.hasChildren(data);
    isSelected = line.classed({
      'selected': !line.classed('selected'),
    }).classed('selected');
    container.classed({
      'has-children': hasChildren,
      'has-selected': container.selectAll('.selected').size() > 0
    });
    if (isSelected) {
      this.addFilter(data).renderChildren(data);
    } else {
      //remove current filter
      this.removeFilter(data).removeChildren(container.node());
    }

    //Only do the transition if the level has children
    if (hasChildren && isSelected)
      container.transition().duration(350).tween('scroll', scrollTween(0));
  };

  LineChart.prototype.getBarHeight = function () {
    if (!this.barHeight) {
      var bar = this.barContainer.select('.line-container');
      this.barHeight = parseInt(bar.style('height'), 10);
    }
    return this.barHeight;
  };

  LineChart.prototype.render = function (data, levelContainer) {
    data = data || this.data.values;
    this.adjustScale(data).adjustColorDomain(data);
    if (!levelContainer) {
      levelContainer = this.barContainer.append('div').attr({
        'class': 'line-chart'
      });
      this.increaseLevel();
    }
    var container = levelContainer.selectAll('div.line-container').data(data, LineChart.key);
    var self = this;
    var newLines = container.enter();
    var height = 0;
    var lines;
    var transition;
    var opacity = 1;

    container.exit().remove();
    newLines.append('div').attr({
      'class': 'line-container'
    }).style({
      'background-color': this.options['background-color'],
      'padding-left': this.options.padding.left + 'px',
      'padding-right': this.options.padding.right + 'px',
      'top': '0px'
    }).each(function () {
      var line = d3.select(this);
      var label = line.append('div').attr('class', 'label-container');
      line.append('div').attr('class', 'line-shadow start').append('div').attr('class', 'line');
      label.append('div').attr('class', 'croptext key-label');
      label.append('div').attr('class', 'size-label');
    });

    container.each(function () {
      var node = d3.select(this);
      node.select('.line').style({
        width: function (data) {
          return self.scale(data.size < 0 ? 0 : data.size) + '%';
        },
        'background-color': function (data) {
          return self.getColor('colorScale', data[self.options.colorProperty]);
        }
      });

      node.select('.key-label').text(function (data) {
        return data.key;
      });
      node.select('.size-label').text(function (data) {
        return self.options.numericFormat(data.size);
      });
    });

    height = this.getBarHeight();
    if (this.levelsRendered > 1) {
      levelContainer.style({top: height + 'px'});
    } else if (this.barContainer.classed('no-animation')) {
      container.style('top', function (data) {
        return (data.__x__ * height) + 'px';
      });
    }

    //remove the start class to fire the transition

    transition = levelContainer;
    if (this.levelsRendered > 1) {
      opacity = 0;
      transition = levelContainer.transition().delay(650);
      transition.duration(350).ease('linear');
    }

    levelContainer.style({
      'opacity': opacity
    });

    d3.timer(function () {
      container.style('top', function (data) {
        return (data.__x__ * height) + 'px';
      });
      container.selectAll('.line-shadow').classed('start', false);
      self.barContainer.classed('no-animation', false);
      transition.style({
        'opacity': 1
      });
      return true;
    }, 100);
  };

  LineChart.prototype.renderChildren = function (data) {
    if (LineChart.hasChildren(data))
      this.render(data.values);
    return this;
  };

  LineChart.prototype.renderLegends = function () {
    if (this.legends.select('div.text-wrapper').size())
      return this;
    var legends = [];
    var upper;
    var lower;
    if (this.options.colorLegend) {
      lower = this.colorScale(this.options.threshold - 1);
      upper = this.colorScale(this.options.threshold + 1);
      legends.push('<span class="legend-text">' + Utils.capitalize(this.options.colorLegend) + ': </span>');
      legends.push('<span class="legend color" style="background-color:' + lower + '"></span>');
      legends.push('&lt; ' + this.options.threshold + ' &lt;');
      legends.push('<span class="legend color legend-spacer" style="background-color:' + upper + '"></span>');
    }

    legends.push('<span class="legend-text">' + Utils.capitalize(this.options.sizeLegend) + ': </span>');
    legends.push('<span class="legend size"></span>');

    this.legends.append('div').attr({
      'class': 'text-wrapper'
    }).node().innerHTML = legends.join('');
    return this;
  };

  LineChart.prototype.removeChildren = function (parent) {
    var children = [];
    var next = parent.nextSibling;
    var self = this;
    var promises = [];
    var filters = [];
    var removeFilter = Utils.proxy(this.removeFilter, this);
    var master;
    while (next) {
      children.unshift(next);
      next = next.nextSibling;
    }
    children.forEach(function (node) {
      var selected = node.querySelectorAll('.selected');
      promises.push(self.closeLevel(node));
      filters = arrayMap.call(selected, function (line) { return line.__data__; });
    });
    master = jQuery.when.apply(null, promises);
    master.done(function () {
      //d3.select(parent).classed('has-selected', false).selectAll('.line-container.selected').classed('selected', false);
      //if we closed a level remove all filters of that level
      if (filters.length)
        filters.forEach(removeFilter);
    });
    return master;
  };

  LineChart.prototype.closeLevel = function (container) {
    container = d3.select(container);
    var deferred = Utils.deferred();
    if (!container.classed('line-chart')) {
      return deferred.resolveWith(this).promise();
    }
    var transition = container.transition();
    transition.style({
      'opacity': 0
    }).duration(250)
      .ease('linear').each('end', function () {
      deferred.resolveWith(this);
    }).remove();
    this.decreaseLevel();
    return deferred.promise();
  };

  LineChart.prototype.increaseLevel = function () {
    this.levelsRendered++;
    return this;
  };

  LineChart.prototype.decreaseLevel = function () {
    this.levelsRendered--;
    if (this.levelsRendered <= 0)
      this.levelsRendered = 1;
    return this;
  };

  LineChart.prototype.addFilter = function (group) {
    var uid = this.generateUID(group.key);
    var filterData;
    if (!(uid in this.filters)) {
      filterData = {name: group.key};
      this.filters[uid] = filterData;
      this.trigger('filter', [[filterData]]);
    }

    //only send the last one
    return this;
  };

  LineChart.prototype.updateFilterInfo = function (filters) {
    if (!Utils.isArray(filters))
      return this;

    var self = this;
    filters.forEach(function(filter) {
      var key = self.generateUID(filter.value);
      if (key in self.filters && filter.id)
        self.filters[key].id = filter.id;
    });
  };

  LineChart.prototype.generateUID = function (str) {
    str = (str || '').replace(/[^a-z0-9]/i, '');
    return str + str.length;
  };

  LineChart.prototype.removeFilter = function (group) {
    var uid = this.generateUID(group.key);
    var filters;
    var index;
    if (!(uid in this.filters)) {
      return this;
    }
    filters = [this.filters[uid]];
    delete this.filters[uid];

    this.trigger('remove-filter', [filters]);
    return this;
  };

  LineChart.prototype.clearFilters = function () {
    var filtersToRemove = [];
    var key;
    for (key in this.filters) {
      filtersToRemove.push(this.filters[key]);
    }
    this.filters = {};
    this.trigger('remove-filter', [filtersToRemove]);
    return this;
  };

  /**
   * Adds an event listener
   * @param String type event name
   * @param Function callback to execute
   * @return LineChart
   *
   */
  LineChart.prototype.addEventListener = function (type, callback) {
    if (!(type in this.events)) {
      this.events[type] = [];
    }
    this.events[type].push(callback);
    return this;
  };

  /**
   * Triggers an event calling all of the callbacks attached to it.
   * @param String type event name
   * @param Array args to pass to the callback
   * @param Object thisArg to execute the callback in a certain context
   * @return LineChart
   *
   */
  LineChart.prototype.trigger = function (type, args, thisArg) {
    if ((type in this.events) && this.events[type].length) {
      args = jQuery.isArray(args) ? args : [];
      thisArg = thisArg || this;
      this.events[type].forEach(function (callback) {
        callback.apply(thisArg, args);
      });
    }
    return this;
  };


  if (!('Visualizations' in main))
    main.Visualizations = {};

  main.Visualizations.LineChart = LineChart;

})(this);
