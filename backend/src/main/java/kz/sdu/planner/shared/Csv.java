package kz.sdu.planner.shared;

import java.util.*;

public final class Csv {
  private Csv() {}

  public static List<Map<String, String>> parse(String text) {
    if (text == null || text.length() > 1_000_000)
      throw new IllegalArgumentException("CSV must be under 1 MB.");
    var rows = new ArrayList<List<String>>();
    var row = new ArrayList<String>();
    var cell = new StringBuilder();
    boolean quoted = false;
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      if (c == '"') {
        if (quoted && i + 1 < text.length() && text.charAt(i + 1) == '"') {
          cell.append('"');
          i++;
        } else quoted = !quoted;
      } else if (c == ',' && !quoted) {
        row.add(cell.toString().trim());
        cell.setLength(0);
      } else if (c == '\n' && !quoted) {
        row.add(cell.toString().trim());
        cell.setLength(0);
        if (row.stream().anyMatch(s -> !s.isEmpty())) rows.add(row);
        row = new ArrayList<>();
      } else if (c != '\r') cell.append(c);
    }
    if (quoted) throw new IllegalArgumentException("CSV has an unclosed quote.");
    row.add(cell.toString().trim());
    if (row.stream().anyMatch(s -> !s.isEmpty())) rows.add(row);
    if (rows.size() < 2)
      throw new IllegalArgumentException("CSV needs a header and at least one data row.");
    var headers = rows.removeFirst();
    headers.set(0, headers.getFirst().replace("\uFEFF", ""));
    if (new HashSet<>(headers).size() != headers.size())
      throw new IllegalArgumentException("CSV headers must be unique.");
    var out = new ArrayList<Map<String, String>>();
    for (var cells : rows) {
      if (cells.size() != headers.size())
        throw new IllegalArgumentException(
            "CSV row " + (out.size() + 2) + " has the wrong number of columns.");
      var values = new LinkedHashMap<String, String>();
      for (int i = 0; i < headers.size(); i++) values.put(headers.get(i), cells.get(i));
      out.add(values);
    }
    return out;
  }

  public static String required(Map<String, String> row, String key) {
    var value = row.get(key);
    if (value == null || value.isBlank())
      throw new IllegalArgumentException("CSV requires a nonempty " + key + " column.");
    return value;
  }
}
