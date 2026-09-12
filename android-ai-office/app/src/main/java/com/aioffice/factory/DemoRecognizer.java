package com.aioffice.factory;

import java.util.LinkedHashMap;

public final class DemoRecognizer {
    private DemoRecognizer() {}

    public static String detectType(String text) {
        if (text == null) return "其他单据";
        if (text.contains("工资") || text.contains("计件") || text.contains("奖金") || text.contains("扣款")) return "工资表";
        if (text.contains("考勤") || text.contains("迟到") || text.contains("请假") || text.contains("加班")) return "考勤表";
        if (text.contains("库存") || text.contains("入库") || text.contains("出库")) return "库存单";
        if (text.contains("生产") || text.contains("订单") || text.contains("产量")) return "生产单";
        if (text.contains("员工") || text.contains("姓名") || text.contains("工号")) return "员工登记表";
        return "其他单据";
    }

    public static RecognitionResult sample(String type) {
        LinkedHashMap<String, String> f = new LinkedHashMap<>();
        switch (type) {
            case "员工登记表":
                f.put("姓名", "张三"); f.put("部门", "包装部"); f.put("工号", "A018"); f.put("入职日期", "2026-09-01"); break;
            case "考勤表":
                f.put("员工", "李四"); f.put("日期", "2026-09-12"); f.put("状态", "正常"); f.put("加班", "2小时"); break;
            case "工资表":
                f.put("员工", "王五"); f.put("基本工资", "6500"); f.put("奖金", "300"); f.put("扣款", "100"); f.put("实发", "6700"); break;
            case "生产单":
                f.put("订单号", "DO20260912001"); f.put("产品", "A产品"); f.put("计划数量", "1200"); f.put("完成数量", "980"); break;
            case "库存单":
                f.put("物料", "包装盒"); f.put("类型", "入库"); f.put("数量", "500"); f.put("仓位", "A-03"); break;
            default:
                f.put("识别内容", "示例文本"); f.put("备注", "第一版使用本地模拟识别，后续接入真实OCR/AI");
        }
        return new RecognitionResult(type, f);
    }
}
