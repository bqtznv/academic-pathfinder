package kz.sdu.planner.shared;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class Json {
  private final ObjectMapper mapper;

  public Json(ObjectMapper mapper) {
    this.mapper = mapper;
  }

  public String write(Object v) {
    try {
      return mapper.writeValueAsString(v);
    } catch (Exception e) {
      throw new IllegalArgumentException("Invalid JSON data.", e);
    }
  }

  public <T> T read(String v, Class<T> type) {
    try {
      return mapper.readValue(v, type);
    } catch (Exception e) {
      throw new IllegalArgumentException(
          "Invalid " + type.getSimpleName() + " data: " + e.getMessage(), e);
    }
  }
}
