// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// The Chart.js configuration
let config = {
  type: 'line',
  data: {
    labels: [],
    datasets: []
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    tooltips: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: function (tooltipItem, data) {
          let label = data.datasets[tooltipItem.datasetIndex].label + ': ';
          label += Math.round(tooltipItem.yLabel * 100) / 100;
          return label;
        }
      }
    },
    elements: {
      point: {
        radius: 0
      },
      line: {
        tension: 0
      }
    },
    legend: {
    },
    hover: {
      mode: 'nearest',
      intersect: true
    },
    scales: {
      xAxes: [{
        display: true,
        scaleLabel: {
          display: true,
          labelString: null
        },
        gridLines: {
          display: false
        },
        ticks: {},
        scaleLabel: {},
        type: 'time',
        time: {
          parser: 'YYYYMMDD',
          tooltipFormat: 'll',
          displayFormats: {
            'day': 'YYYY-MM-DD',
            'week': 'YYYY-MM-DD',
            'month': 'MMM YYYY'
          },
        }
      }],
      yAxes: [{
        display: true,
        scaleLabel: {
          display: true,
          labelString: null
        },
        gridLines: {
          display: false
        }
      }]
    }
  }
};


let chart = null;
let wrapper = null;

function drawViz(data) {
  // Create the chart if it does not exist yet
  if (chart === null) {
    // Create a wrapper that houses the canvas and scales depending on the Data
    // Studio element size. This is required for Chart.js to scale responsively.
    wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    document.body.appendChild(wrapper);

    const canvas = document.createElement("canvas");
    canvas.setAttribute('width','100%');
    canvas.setAttribute('height', '100%');
    wrapper.appendChild(canvas);

    const context = canvas.getContext('2d');
    chart = new Chart(context, config);
  }

  wrapper.style.width = dscc.getWidth() + 'px';
  wrapper.style.height = dscc.getHeight() + 'px';

  // Clear the existing labels and data sets (since the method `drawViz` is
  // called repeatedly, and we don't want duplicate data to show up)
  config.data.labels = [];
  config.data.datasets = [];

  // Set the labels of the X and Y axes of the chart to the main dimension name
  // and metric name, respectively
  config.options.scales.xAxes[0].scaleLabel.labelString = data.fields.mainDimension[0].name;
  config.options.scales.yAxes[0].scaleLabel.labelString = data.fields.metric[0].name;

  const table = data.tables.DEFAULT;

  // Build a map `metricValues` that maps a combination of a main dimension value
  // and breakdown dimension value to the value of the metric at that point
  const metricValues = new Map();
  for (const row of table.rows) {
    metricValues.set(row[0] + '|' + row[1], row[2]);
  }

  // Remove duplicates along all main dimension values and use the resulting
  // sorted list as the labels
  const mainDimValues = Array.from(new Set(data.tables.DEFAULT.rows.map(row => row[0])));
  mainDimValues.sort();
  config.data.labels = mainDimValues;

  const breakdownDimValues = Array.from(new Set(data.tables.DEFAULT.rows.map(row => row[1])));

  // Maps a breakdown dimension to the sum of all metrics values. This allows us
  // to select the top-N most relevant breakdown dimensions later.
  const breakdownDimMetricSum = new Map();

  // Maps a breakdown dimensions to an array of length `labels` representing
  // all the metric values for that breakdown dimension.
  const breakdownDimMetricValues = new Map();

  for (const breakdownDimValue of breakdownDimValues) {
    const values = mainDimValues.map(mainDimValue => metricValues.get(mainDimValue + '|' + breakdownDimValue) ?? 0);
    breakdownDimMetricValues.set(breakdownDimValue, values);

    const sum = values.reduce((a, b) => a + b, 0);
    breakdownDimMetricSum.set(breakdownDimValue, sum);
  }

  if (data.fields.mainDimension[0].type === 'YEAR_MONTH_DAY') {
    config.options.scales.xAxes[0].time.parser = 'YYYYMMDD';
    config.options.scales.xAxes[0].time.unit = 'day';
  } else if (data.fields.mainDimension[0].type === 'YEAR_WEEK') {
    config.options.scales.xAxes[0].time.parser = 'YYYYWW';
    config.options.scales.xAxes[0].time.unit = 'week';
  } else if (data.fields.mainDimension[0].type === 'YEAR_MONTH') {
    config.options.scales.xAxes[0].time.parser = 'YYYYMM';
    config.options.scales.xAxes[0].time.unit = 'month';
  } else if (data.fields.mainDimension[0].type === 'YEAR_QUARTER') {
    config.options.scales.xAxes[0].time.parser = 'YYYYQ';
    config.options.scales.xAxes[0].time.unit = 'quarter';
  } else if (data.fields.mainDimension[0].type === 'YEAR') {
    config.options.scales.xAxes[0].time.parser = 'YYYY';
    config.options.scales.xAxes[0].time.unit = 'year';
  }

  // Sort the breakdown dimensions by the average value of the metric, so we can
  // select the top N breakdown dimensions to display
  breakdownDimValues.sort((a, b) => a === '' ? -1 : (b === '' ? 1 : breakdownDimMetricSum.get(b) - breakdownDimMetricSum.get(a)));
  breakdownDimValues.sort((a, b)=> breakdownDimMetricSum.get(b) - breakdownDimMetricSum.get(a));

  const maximumBreakdownDims = parseInt(data.style.maximumBreakdownDimensions.value, 10);
  for (let i = 0; i < maximumBreakdownDims && i < breakdownDimValues.length; i++) {
    const breakdownDimension = breakdownDimValues[i];

    const values = breakdownDimMetricValues.get(breakdownDimension);
    const color = data.theme.themeSeriesColor[i % data.theme.themeSeriesColor.length].color;

    config.data.datasets.push({
      label: breakdownDimension !== '' ? breakdownDimension : 'You',
      backgroundColor: color,
      borderDash: data.style.seriesDashedLines.value ? [5, 5] : [],
      borderColor: color,
      borderWidth: 2,
      data: values,
      fill: false,
    });
  }

  config.options.scales.yAxes[0].position = data.style.verticalAxisPosition.value;

  // Set a custom callback to render the metric ticks based on the metric type
  const metricType = data.fields.metric[0].type;
  if (metricType === 'PERCENT') {
    config.options.scales.yAxes[0].ticks = {
      callback: (value, index, values) => (Math.round(value * 10000) / 100) + ' %'
    }
  } else if (metricType === 'CURRENCY_ EUR') {
    config.options.scales.yAxes[0].ticks = {
      callback: (value, index, values) => '€ ' + value
    }
  } else if (metricType === 'CURRENCY_ USD') {
    config.options.scales.yAxes[0].ticks = {
      callback: (value, index, values) => '$ ' + value
    }
  } else if (metricType === 'CURRENCY_ GBP') {
    config.options.scales.yAxes[0].ticks = {
      callback: (value, index, values) => '£ ' + value
    }
  } else {
    delete config.options.scales.yAxes[0].ticks;
  }

  // Set both the ticks and axes label font color based on the specified style
  const horizontalAxisColor = 'rgba(102, 102, 102,' + data.style.horizontalAxisOpacity.value + ')';
  config.options.scales.xAxes[0].ticks.fontColor = horizontalAxisColor;
  config.options.scales.xAxes[0].scaleLabel.fontColor = horizontalAxisColor;

  // Show gridlines if enabled
  config.options.scales.xAxes[0].gridLines.display = data.style.showGrid.value;
  config.options.scales.yAxes[0].gridLines.display = data.style.showGrid.value;

  const legendPosition = data.style.legendPosition.value;
  if (legendPosition === 'hidden') {
    config.options.legend.display = false;
  } else {
    config.options.legend.display = true;
    config.options.legend.position = legendPosition;
  }

  // Update the chart without animating
  chart.update(0);
}

// Subscribe to data and style changes
dscc.subscribeToData(drawViz, {transform: dscc.tableTransform});
