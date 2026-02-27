const PERIOD_MONTHS = 84;
const DAY_MS = 24 * 60 * 60 * 1000;
const SUGAR_IMAGES = ["./images/sugar1.jpeg", "./images/sugar2.jpeg"];

const PERIODS = {
  past: {
    key: "past",
    label: "1983.06 시작",
    start: new Date("1983-06-01"),
    end: new Date("1990-06-01"),
    color: "#d4a93b",
  },
  current: {
    key: "current",
    label: "2023.01 시작",
    start: new Date("2023-01-01"),
    end: new Date("2030-01-01"),
    color: "#191919",
  },
};

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const [date, open, high, low, close, volume] = lines[i].split(",");
    if (!date || !close || close === "null") continue;
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) continue;
    rows.push({
      date: d,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
    });
  }
  return rows;
}

function toPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function pickSeries(allRows, period) {
  const filtered = allRows.filter((r) => r.date >= period.start && r.date <= period.end);
  if (!filtered.length) {
    throw new Error(`${period.label} 구간 데이터가 없습니다.`);
  }
  const startClose = filtered[0].close;
  const points = filtered.map((row) => {
    const days = (row.date.getTime() - period.start.getTime()) / DAY_MS;
    return {
      t: days / 30.4375,
      date: row.date,
      close: row.close,
      normalized: (row.close / startClose) * 100,
    };
  });
  return { points, startClose, firstDate: filtered[0].date, lastDate: filtered[filtered.length - 1].date };
}

function addMonths(date, months) {
  const out = new Date(date);
  out.setMonth(out.getMonth() + months);
  return out;
}

function fmtYm(date) {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildTicks() {
  const values = [];
  const text = [];
  for (let m = 0; m <= PERIOD_MONTHS; m += 12) {
    values.push(m);
    const currentDate = addMonths(PERIODS.current.start, m);
    const pastDate = addMonths(PERIODS.past.start, m);
    text.push(`${fmtYm(currentDate)}<br>${fmtYm(pastDate)}`);
  }
  return { values, text };
}

function renderStats(pastData, currentData, mode) {
  const stats = document.getElementById("stats");
  const currentLast = currentData.points[currentData.points.length - 1];
  const pastLast = pastData.points[pastData.points.length - 1];
  const curGrowth = currentLast.normalized / 100 - 1;
  const pastGrowth = pastLast.normalized / 100 - 1;

  const modeText =
    mode === "normalized"
      ? "모드: 상승률(시작점=100)"
      : "모드: 1983 구간을 2023 시작값으로 환산";

  stats.innerHTML = `
    <div class="stat">
      <span class="label">${modeText}</span>
      <span class="value">로그 스케일</span>
    </div>
    <div class="stat">
      <span class="label">2023 구간 현재 누적</span>
      <span class="value">${toPct(curGrowth)}</span>
    </div>
    <div class="stat">
      <span class="label">1983~1990 구간 누적</span>
      <span class="value">${toPct(pastGrowth)}</span>
    </div>
  `;
}

function findNearestPointIndex(xValues, targetX) {
  let left = 0;
  let right = xValues.length - 1;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (Number(xValues[mid]) < targetX) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  if (left === 0) return 0;
  const prev = left - 1;
  const leftDist = Math.abs(Number(xValues[left]) - targetX);
  const prevDist = Math.abs(Number(xValues[prev]) - targetX);
  return prevDist <= leftDist ? prev : left;
}

function setupMobileTouchHover(chart) {
  if (!("ontouchstart" in window) || !Plotly?.Fx?.hover) return;

  if (typeof chart.__touchHoverCleanup === "function") {
    chart.__touchHoverCleanup();
  }

  const onTouchMove = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;

    const xaxis = chart?._fullLayout?.xaxis;
    if (!xaxis || !xaxis._length) return;

    const rect = chart.getBoundingClientRect();
    const pointerX = touch.clientX - rect.left;
    const plotX = pointerX - xaxis._offset;
    const ratio = Math.max(0, Math.min(1, plotX / xaxis._length));
    const xRange = xaxis.range || [0, PERIOD_MONTHS];
    const xValue = xRange[0] + ratio * (xRange[1] - xRange[0]);

    const hoverPoints = [];
    (chart.data || []).forEach((trace, curveNumber) => {
      if (!Array.isArray(trace.x) || trace.x.length === 0) return;
      const pointNumber = findNearestPointIndex(trace.x, xValue);
      hoverPoints.push({ curveNumber, pointNumber });
    });

    if (hoverPoints.length) {
      Plotly.Fx.hover(chart, hoverPoints, "xy");
      event.preventDefault();
    }
  };

  const onTouchStart = (event) => onTouchMove(event);
  const onTouchEnd = () => Plotly.Fx.unhover(chart);

  chart.addEventListener("touchstart", onTouchStart, { passive: false });
  chart.addEventListener("touchmove", onTouchMove, { passive: false });
  chart.addEventListener("touchend", onTouchEnd, { passive: true });
  chart.addEventListener("touchcancel", onTouchEnd, { passive: true });

  chart.__touchHoverCleanup = () => {
    chart.removeEventListener("touchstart", onTouchStart);
    chart.removeEventListener("touchmove", onTouchMove);
    chart.removeEventListener("touchend", onTouchEnd);
    chart.removeEventListener("touchcancel", onTouchEnd);
  };
}

function makeTrace(series, mode, scaleToCurrent = 1) {
  const isRebased = mode === "rebased";
  return {
    x: series.points.map((p) => p.t),
    y: series.points.map((p) => (isRebased ? p.close * scaleToCurrent : p.normalized)),
    name: series.key === "current" ? "2023~현재" : "1983.06~1990.06",
    mode: "lines",
    line: { width: 4, color: series.color },
    customdata: series.points.map((p) => [fmtYm(p.date), p.close.toFixed(2), p.normalized.toFixed(2)]),
    hovertemplate:
      "<b>%{fullData.name}</b><br>" +
      "경과 %{x:.1f}개월<br>" +
      "실제 월: %{customdata[0]}<br>" +
      (isRebased
        ? "환산 코스피: %{y:.2f}<br>원본 종가: %{customdata[1]}"
        : "상승률지수: %{customdata[2]}") +
      "<extra></extra>",
  };
}

function renderChart(pastSeriesRaw, currentSeriesRaw, mode) {
  const chart = document.getElementById("chart");
  const ticks = buildTicks();
  const scale = currentSeriesRaw.startClose / pastSeriesRaw.startClose;

  const pastSeries = { ...PERIODS.past, points: pastSeriesRaw.points };
  const currentSeries = { ...PERIODS.current, points: currentSeriesRaw.points };

  const traces = [
    makeTrace(currentSeries, mode, 1),
    makeTrace(pastSeries, mode, scale),
  ];

  const rebasedYaxis = {
    type: "log",
    title: "코스피 지수 (환산, log)",
    autorange: true,
    tickmode: "array",
    tickvals: [2000, 4000, 8000, 16000],
    ticktext: ["2,000", "4,000", "8,000", "16,000"],
    gridcolor: "#e6e6e6",
    zeroline: false,
  };

  const normalizedYaxis = {
    type: "log",
    title: "상승률 지수 (시작=100, log)",
    autorange: true,
    gridcolor: "#e6e6e6",
    zeroline: false,
  };

  const layout = {
    margin: { l: 60, r: 24, t: 24, b: 70 },
    paper_bgcolor: "white",
    plot_bgcolor: "white",
    hovermode: "x unified",
    dragmode: false,
    legend: { orientation: "h", x: 0.02, y: 1.1 },
    xaxis: {
      title: "경과 개월 (윗줄=2023 시작, 아랫줄=1983 시작)",
      range: [0, PERIOD_MONTHS],
      tickvals: ticks.values,
      ticktext: ticks.text,
      fixedrange: true,
      showspikes: true,
      spikemode: "across",
      spikecolor: "#999999",
      spikethickness: 1,
      gridcolor: "#e6e6e6",
      zeroline: false,
    },
    yaxis: {
      ...(mode === "rebased" ? rebasedYaxis : normalizedYaxis),
      fixedrange: true,
    },
  };

  Plotly.newPlot(chart, traces, layout, {
    responsive: true,
    displaylogo: false,
    displayModeBar: false,
    scrollZoom: false,
    doubleClick: false,
  }).then(() => {
    setupMobileTouchHover(chart);
  });
}

function setupForbiddenButton() {
  const button = document.getElementById("forbidden-btn");
  const image = document.getElementById("sugar-image");
  const result = document.getElementById("sugar-result");
  if (!button || !image || !result) return;

  button.addEventListener("click", () => {
    const picked = SUGAR_IMAGES[Math.floor(Math.random() * SUGAR_IMAGES.length)];
    image.src = `${picked}?t=${Date.now()}`;
    result.hidden = false;
  });
}

async function bootstrap() {
  setupForbiddenButton();
  try {
    const response = await fetch("./data/kospi.csv");
    if (!response.ok) {
      throw new Error("데이터 파일을 읽을 수 없습니다. scripts/fetch_kospi.py를 먼저 실행하세요.");
    }
    const csv = await response.text();
    const allRows = parseCsv(csv);
    const past = pickSeries(allRows, PERIODS.past);
    const current = pickSeries(allRows, PERIODS.current);

    const modeSelect = document.getElementById("mode");
    modeSelect.value = "rebased";
    const draw = () => {
      const mode = modeSelect.value;
      renderChart(past, current, mode);
      renderStats(past, current, mode);
    };
    modeSelect.addEventListener("change", draw);
    draw();
  } catch (err) {
    document.getElementById("chart").innerHTML = `<pre>${err.message}</pre>`;
  }
}

window.addEventListener("DOMContentLoaded", bootstrap);
