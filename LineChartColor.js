{
  id: 'com.oracle.bimad.LineBarChart',
  component: {
    'name': 'Line Bar Chart',
    'tooltip': 'Line Bar Chart is a variation of Bar chart, each bar is represented as a line with label and data values positioned right on top of the line. You can scroll up or down to see more data points. It supports hierarchical data filtering so that you can tap or click on each Line Bar to drill down to the next level.',
    'description': 'Line Bar Chart is a variation of Bar chart, each bar is represented as a line with label and data values positioned right on top of the line. You can scroll up or down to see more data points. It supports hierarchical data filtering so that you can tap or click on each Line Bar to drill down to the next level.',
    'cssClass': 'line-chart-plugin',
    'icon': 'asset://official-plugin.png'
  },
  properties: [
    {key: "width", label: "Width", type: "length", value: "1024px"},
    {key: "height", label: "Height", type: "length", value: "300px"},
    {key: "defaultcolor", label: "Default Color", type: "color", value: '#00bfff'},
    {key: "threshold", label: "Threshold", type: "number", value: "0"},
    {key: "startcolor", label: "Lower Color", type: "color", value: '#ff1300'},
    {key: "endcolor", label: "Upper Color", type: "color", value: '#46b319'}
  ],
  remoteFiles: [
    {
      type:'js',
      location: '//cdnjs.cloudflare.com/ajax/libs/d3/3.5.2/d3.min.js',
      isLoaded: function() {
        return ('d3' in window);
      }
    },
    {
      type:'js',
      location: 'asset://js/LineChart.concat.js',
      isLoaded: function() {
        return 'Visualizations' in window && 'LineChart' in Visualizations;
      }
    },
    {
      type:'css',
      location:'asset://css/style.css'
    }
  ],
  fields: [
    {name: "group", caption: "Drop Main Group Field Here", fieldType: "label", dataType: "string"},
    {name: "subgroup", caption: "Drop Subgroup Field Here", fieldType: "label", dataType: "string", optional: true},
    {name: "size", caption: "Drop Size Field Here", fieldType: "measure", dataType: "number", formula: "summation", formatMask: '#,###'},
    {name: "color", caption: "Drop Color Field Here", fieldType: "measure", dataType: "number", formula: "summation", optional: true}
  ],
  dataType: 'arrayOfArrays',
  avoidRefresh: false,
  getColorScheme: function (props) {
    return [props.startcolor, props.endcolor];
  },
  render: function (context, container, data, fields, props) {
    var columnOrder = ['group'];

    if (typeof data[0][1] === 'string' && data[0][1].length)
      columnOrder.push('subgroup');

    container.innerHTML = '';
    this.dataModel = new bimad.utils.DataModel(data, fields);
    this.dataModel.indexColumns().setColumnOrder(columnOrder, false);
    var nested = this.dataModel.nest();
    var self = this;
    var colors = this.getColorScheme(props);
    var indexedFields = this.dataModel.indexedMetaData;
    var colorLegend = indexedFields.color.label;
    if (isNaN(parseInt(data[0][3]))) {
      colors = [props.defaultcolor];
      colorLegend = null;
    }


    this.visualization = new Visualizations.LineChart(container, nested, {
      colors: colors,
      width: props.width,
      height: props.height,
      'background-color': '#fff',
      numericFormat: this.getFormatter(indexedFields.size),
      threshold: +props.threshold,
      colorLegend: colorLegend,
      sizeLegend: indexedFields.size.label
    });
    this.visualization.renderLegends().render();
    this.visualization.addEventListener('filter', function (filters) {
      filters = self.constructFilters(filters, context);
      xdo.api.handleClickEvent(filters);
      this.updateFilterInfo(filters.filter);
    }).addEventListener('remove-filter', function (filters) {
      self.avoidRefresh = true;
      filters.forEach(function (filter) {
        try{
             xdo.app.viewer.GlobalFilter.removeFilter(context.id, filter.id, false);
        } catch (e) {}
      });
    });

  },
  refresh: function (context, container, data, fields, props) {
    var colors = this.getColorScheme(props)
    if (isNaN(parseInt(data[0][3])))
      colors = [props.defaultcolor];
    //hack to avoid refresh when removing filters from this plugin
    if (!this.avoidRefresh) {
      var self = this;
      var parent = this.visualization.container.select('.line-chart');
      this.dataModel.setData(data).indexColumns();
      this.visualization.setColors(colors)
          .setData(this.dataModel.nest());
      this.visualization.removeChildren(parent.node()).done(function () {
        self.visualization.render(null, parent);
      });
    }
    this.avoidRefresh = false;
  },
  getFormatter: function (field, props) {
    if (xdo.api.format && field.dataType === 'number')
      return xdo.api.format(field.dataType, field.formatMask);

    return bimad.utils.format('thousands');
  },
  constructFilters: function (data, context) {
    var group = this.dataModel.indexedMetaData.group.field;
    var filters = [];
    var children;
    for (var key in data) {
      filters.push({field: group, value: data[key].name});
    }

    return {
      id: context.id,
      filter: filters
    };
  }

}
