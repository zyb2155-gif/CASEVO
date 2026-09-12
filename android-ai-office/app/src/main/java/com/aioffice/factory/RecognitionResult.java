package com.aioffice.factory;

import java.util.LinkedHashMap;
import java.util.Map;

public class RecognitionResult {
    public final String type;
    public final LinkedHashMap<String, String> fields;

    public RecognitionResult(String type, LinkedHashMap<String, String> fields) {
        this.type = type;
        this.fields = fields;
    }

    public String asEditableText() {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : fields.entrySet()) {
            if (sb.length() > 0) sb.append("\n");
            sb.append(entry.getKey()).append(": ").append(entry.getValue());
        }
        return sb.toString();
    }
}
