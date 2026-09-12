package com.aioffice.factory;

public final class OfficeTemplates {
    private OfficeTemplates() {}

    public static String notice(String dept, String reason, String detail) {
        return "【工作通知】\n" + dept + "：因" + reason + "，" + detail + "。请相关人员提前做好工作安排。";
    }

    public static String recruit(String role, String count, String salary, String benefits) {
        return "【招聘】" + role + " " + count + "名\n薪资：" + salary + "\n福利：" + benefits + "\n要求：责任心强，服从现场安排，有相关经验优先。";
    }

    public static String dailyReport(String line, String planned, String actual, String issue) {
        return "【生产日报】\n产线/班组：" + line + "\n计划：" + planned + "\n完成：" + actual + "\n异常：" + issue;
    }
}
