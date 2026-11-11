import SwiftUI
import WidgetKit

// Должен совпадать с APP_GROUP в src/config.ts и с app.json.
private let appGroup = "group.com.yourname.sleeptracker"

struct SleepEntry: TimelineEntry {
  let date: Date
  let hasData: Bool
  let score: Int
  let label: String
  let sleepMin: Int
  let deepMin: Int
  let remMin: Int
  let lightMin: Int
  let awakeMin: Int
  let snoreMin: Int
  let nextAlarm: String

  static let sample = SleepEntry(
    date: Date(), hasData: true, score: 82, label: "Хороший сон", sleepMin: 452,
    deepMin: 84, remMin: 96, lightMin: 272, awakeMin: 18, snoreMin: 12, nextAlarm: "07:30")

  static func load() -> SleepEntry {
    let d = UserDefaults(suiteName: appGroup)
    let score = d?.integer(forKey: "score") ?? 0
    return SleepEntry(
      date: Date(),
      hasData: d?.object(forKey: "score") != nil,
      score: score,
      label: d?.string(forKey: "label") ?? "",
      sleepMin: d?.integer(forKey: "sleepMin") ?? 0,
      deepMin: d?.integer(forKey: "deepMin") ?? 0,
      remMin: d?.integer(forKey: "remMin") ?? 0,
      lightMin: d?.integer(forKey: "lightMin") ?? 0,
      awakeMin: d?.integer(forKey: "awakeMin") ?? 0,
      snoreMin: d?.integer(forKey: "snoreMin") ?? 0,
      nextAlarm: d?.string(forKey: "nextAlarm") ?? "")
  }

  var duration: String { "\(sleepMin / 60) ч \(String(format: "%02d", sleepMin % 60)) мин" }

  var color: Color {
    if score >= 85 { return Color(red: 0.29, green: 0.87, blue: 0.50) }
    if score >= 70 { return Color(red: 0.49, green: 0.55, blue: 1.0) }
    if score >= 50 { return Color(red: 0.98, green: 0.75, blue: 0.14) }
    return Color(red: 0.97, green: 0.44, blue: 0.44)
  }
}

struct SleepProvider: TimelineProvider {
  func placeholder(in context: Context) -> SleepEntry { .sample }

  func getSnapshot(in context: Context, completion: @escaping (SleepEntry) -> Void) {
    completion(context.isPreview ? .sample : .load())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SleepEntry>) -> Void) {
    // Приложение само перезагружает виджет после каждой ночи; раз в час — на всякий случай.
    completion(Timeline(entries: [.load()], policy: .after(Date().addingTimeInterval(3600))))
  }
}

struct ScoreRing: View {
  let entry: SleepEntry
  var lineWidth: CGFloat = 9

  var body: some View {
    ZStack {
      Circle().stroke(Color.white.opacity(0.12), lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: CGFloat(entry.score) / 100)
        .stroke(entry.color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
      Text("\(entry.score)")
        .font(.system(size: 30, weight: .bold, design: .rounded))
        .foregroundStyle(.white)
    }
  }
}

struct StageRow: View {
  let name: String
  let minutes: Int
  let total: Int
  let color: Color

  var body: some View {
    HStack(spacing: 6) {
      Text(name).font(.caption2).foregroundStyle(.white.opacity(0.7)).frame(width: 58, alignment: .leading)
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(Color.white.opacity(0.12))
          Capsule().fill(color).frame(width: geo.size.width * CGFloat(minutes) / CGFloat(max(total, 1)))
        }
      }
      .frame(height: 6)
      Text("\(minutes / 60):\(String(format: "%02d", minutes % 60))")
        .font(.caption2.monospacedDigit()).foregroundStyle(.white.opacity(0.7))
    }
  }
}

struct SleepWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: SleepEntry

  var body: some View {
    Group {
      if !entry.hasData {
        Text("Нет данных о сне").font(.footnote).foregroundStyle(.secondary)
      } else {
        switch family {
        case .accessoryCircular:
          Gauge(value: Double(entry.score), in: 0...100) { Text("сон") } currentValueLabel: { Text("\(entry.score)") }
            .gaugeStyle(.accessoryCircular)
        case .accessoryRectangular:
          VStack(alignment: .leading, spacing: 2) {
            Text("Сон: \(entry.score) из 100").font(.headline)
            Text(entry.duration).font(.caption)
            if !entry.nextAlarm.isEmpty { Text("Будильник \(entry.nextAlarm)").font(.caption2) }
          }
        case .systemMedium:
          HStack(spacing: 16) {
            VStack(spacing: 6) {
              ScoreRing(entry: entry).frame(width: 84, height: 84)
              Text(entry.duration).font(.caption).foregroundStyle(.white.opacity(0.8))
            }
            VStack(alignment: .leading, spacing: 7) {
              Text(entry.label).font(.subheadline.weight(.semibold)).foregroundStyle(.white)
              let total = entry.sleepMin + entry.awakeMin
              StageRow(name: "Глубокий", minutes: entry.deepMin, total: total, color: Color(red: 0.26, green: 0.22, blue: 0.79))
              StageRow(name: "Лёгкий", minutes: entry.lightMin, total: total, color: Color(red: 0.38, green: 0.65, blue: 0.98))
              StageRow(name: "REM", minutes: entry.remMin, total: total, color: Color(red: 0.65, green: 0.55, blue: 0.98))
              HStack {
                if entry.snoreMin > 0 { Text("Храп \(entry.snoreMin) мин") }
                Spacer()
                if !entry.nextAlarm.isEmpty { Text("⏰ \(entry.nextAlarm)") }
              }
              .font(.caption2).foregroundStyle(.white.opacity(0.7))
            }
          }
        default:
          VStack(spacing: 6) {
            ScoreRing(entry: entry).frame(width: 84, height: 84)
            Text(entry.duration).font(.caption).foregroundStyle(.white.opacity(0.8))
            if !entry.nextAlarm.isEmpty {
              Text("⏰ \(entry.nextAlarm)").font(.caption2).foregroundStyle(.white.opacity(0.6))
            }
          }
        }
      }
    }
    .containerBackground(for: .widget) { Color(red: 0.04, green: 0.06, blue: 0.13) }
  }
}

struct SleepWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SleepWidget", provider: SleepProvider()) { entry in
      SleepWidgetView(entry: entry)
    }
    .configurationDisplayName("Оценка сна")
    .description("Оценка прошлой ночи, фазы сна и время будильника.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular])
  }
}

@main
struct SleepWidgetBundle: WidgetBundle {
  var body: some Widget {
    SleepWidget()
  }
}
