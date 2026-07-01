import * as React from "react";
import { useEffect } from "react";
import {
  ChartComponent,
  SeriesCollectionDirective,
  SeriesDirective,
  Inject,
  Legend,
  Category,
  Tooltip,
  DataLabel,
  HistogramSeries,
} from "@syncfusion/ej2-react-charts";
import { Browser } from "@syncfusion/ej2-base";

export let chartData = [];
let points = [
  5.25, 7.75, 0, 8.275, 9.75, 7.75, 8.275, 6.25, 5.75, 5.25, 23.0, 26.5, 27.75,
  25.025, 26.5, 28.025, 29.25, 26.75, 27.25, 26.25, 25.25, 34.5, 25.625, 25.5,
  26.625, 36.275, 36.25, 26.875, 40.0, 43.0, 46.5, 47.75, 45.025, 56.5, 58.025,
  59.25, 56.75, 57.25, 46.25, 55.25, 44.5, 45.525, 55.5, 46.625, 46.275, 56.25,
  46.875, 43.0, 46.25, 55.25, 44.5, 45.425, 55.5, 56.625, 46.275, 56.25, 46.875,
  43.0, 46.25, 55.25, 44.5, 45.425, 55.5, 46.625, 56.275, 46.25, 56.875, 41.0,
  63.0, 66.5, 67.75, 65.025, 66.5, 76.5, 78.025, 79.25, 76.75, 77.25, 66.25,
  75.25, 74.5, 65.625, 75.5, 76.625, 76.275, 66.25, 66.875, 80.0, 85.25, 87.75,
  89.0, 88.275, 89.75, 97.75, 98.275, 96.25, 95.75, 95.25,
];
points.map((value) => {
  chartData.push({
    y: value,
  });
});

const SAMPLE_CSS = `
    .control-fluid {
        padding: 0px !important;
    }`;

const Histogram = () => {
  const onChartLoad = (args) => {
    let chart = document.getElementById("charts");
    chart.setAttribute("title", "");
  };

  const load = (args) => {
    const selectedTheme = "Material"; // 默认主题为 Material
    if (selectedTheme === "HighContrast") {
      args.chart.series[0].marker.dataLabel.font.color = "#000000";
    } else {
      args.chart.series[0].marker.dataLabel.font.color = "#ffffff";
    }
  };

  return (
    <div className="control-pane">
      <style>{SAMPLE_CSS}</style>
      <div className="control-section">
        <ChartComponent
          id="charts"
          style={{ textAlign: "center" }}
          load={load.bind(this)}
          primaryXAxis={{
            majorGridLines: { width: 0 },
            title: "Score of Final Examination",
            minimum: 0,
            maximum: 100,
            edgeLabelPlacement: "Shift",
          }}
          primaryYAxis={{
            title: "Number of Students",
            minimum: 0,
            maximum: 50,
            interval: 10,
            majorTickLines: { width: 0 },
            lineStyle: { width: 0 },
          }}
          chartArea={{ border: { width: 0 } }}
          tooltip={{ enable: true, header: " " }}
          width={Browser.isDevice ? "100%" : "75%"}
          legendSettings={{ visible: false }}
          title="Examination Result"
          loaded={onChartLoad.bind(this)}
        >
          <Inject
            services={[
              HistogramSeries,
              Legend,
              Tooltip,
              Category,
              DataLabel,
            ]}
          />
          <SeriesCollectionDirective>
            <SeriesDirective
              dataSource={chartData}
              yName="y"
              name="Score"
              type="Histogram"
              marker={{
                visible: true,
                height: 7,
                width: 7,
                dataLabel: {
                  visible: true,
                  position: "Top",
                  font: { color: "#ffffff", fontWeight: "600" },
                },
              }}
              showNormalDistribution={true}
              columnWidth={0.99}
              binInterval={20}
            />
          </SeriesCollectionDirective>
        </ChartComponent>
      </div>
    </div>
  );
};

export default Histogram;