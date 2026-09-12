package com.aioffice.factory;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int REQ_CAMERA = 10;
    private LinearLayout page;
    private android.content.SharedPreferences prefs;
    private String selectedType = "员工登记表";

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("factory_data", MODE_PRIVATE);
        showHome();
    }

    private TextView text(String value, int size, boolean bold) {
        TextView t = new TextView(this);
        t.setText(value); t.setTextSize(size); t.setTextColor(Color.rgb(32,40,56));
        t.setPadding(dp(8), dp(8), dp(8), dp(8));
        if (bold) t.setTypeface(null, android.graphics.Typeface.BOLD);
        return t;
    }

    private Button button(String label) { Button b = new Button(this); b.setText(label); b.setAllCaps(false); return b; }
    private LinearLayout.LayoutParams lp() { LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1,-2); p.setMargins(0,dp(6),0,dp(6)); return p; }
    private int dp(int v) { return (int)(v * getResources().getDisplayMetrics().density + 0.5f); }

    private void shell(String title, boolean back) {
        ScrollView scroll = new ScrollView(this);
        page = new LinearLayout(this); page.setOrientation(LinearLayout.VERTICAL); page.setPadding(dp(16),dp(14),dp(16),dp(28));
        if (back) { Button b = button("← 返回"); b.setOnClickListener(v -> showHome()); page.addView(b, lp()); }
        page.addView(text(title, 26, true), lp());
        TextView sub = text("小工厂智能办公助手 · v1.0", 13, false); sub.setTextColor(Color.GRAY); page.addView(sub, lp());
        scroll.addView(page); setContentView(scroll);
    }

    private void showHome() {
        shell("AI办公助手", false);
        page.addView(text("拍一下，工厂数据自动录入", 19, true), lp());
        Button scan = button("📷 拍照识别 / 上传单据"); scan.setOnClickListener(v -> showScan()); page.addView(scan, lp());
        addModule("👥 人事管理", "employees");
        addModule("🗓 考勤管理", "attendance");
        addModule("💴 工资管理", "salary");
        addModule("🏭 生产管理", "production");
        addModule("📦 库存管理", "inventory");
        Button ai = button("🤖 AI办公助手\n通知 · 招聘 · 生产日报"); ai.setOnClickListener(v -> showAI()); page.addView(ai, lp());
        page.addView(text("第一版采用本地演示识别流程；真实OCR/云AI下一版接入。", 12, false), lp());
    }

    private void addModule(String title, String key) {
        Button b = button(title); b.setGravity(Gravity.LEFT|Gravity.CENTER_VERTICAL); b.setOnClickListener(v -> showRecords(title,key)); page.addView(b,lp());
    }

    private void showScan() {
        shell("拍照识别", true);
        String[] types = {"员工登记表","考勤表","工资表","生产单","库存单","其他单据"};
        Spinner s = new Spinner(this); s.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, types));
        s.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener() {
            public void onItemSelected(android.widget.AdapterView<?> p, View v, int pos, long id) { selectedType = types[pos]; }
            public void onNothingSelected(android.widget.AdapterView<?> p) {}
        }); page.addView(s,lp());
        Button cam = button("📷 拍照"); cam.setOnClickListener(v -> { try { startActivityForResult(new Intent(MediaStore.ACTION_IMAGE_CAPTURE), REQ_CAMERA); } catch(Exception e) { showRecognition(); } }); page.addView(cam,lp());
        Button demo = button("✨ 直接体验识别结果"); demo.setOnClickListener(v -> showRecognition()); page.addView(demo,lp());
        page.addView(text("照片 → OCR → AI理解 → 结果预览 → 人工确认 → 一键导入",14,false),lp());
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_CAMERA && resultCode == RESULT_OK) showRecognition();
    }

    private void showRecognition() {
        RecognitionResult r = DemoRecognizer.sample(selectedType);
        shell("识别结果预览", true);
        page.addView(text("识别为：" + r.type,18,true),lp());
        EditText edit = new EditText(this); edit.setText(r.asEditableText()); edit.setMinLines(8); edit.setGravity(Gravity.TOP); page.addView(edit,lp());
        Button save = button("✓ 确认并一键导入"); save.setOnClickListener(v -> {
            String key = keyForType(r.type); appendRecord(key, edit.getText().toString());
            Toast.makeText(this,"已导入",Toast.LENGTH_SHORT).show(); showRecords(titleForKey(key),key);
        }); page.addView(save,lp());
    }

    private String keyForType(String type) {
        if(type.contains("员工")) return "employees"; if(type.contains("考勤")) return "attendance"; if(type.contains("工资")) return "salary"; if(type.contains("生产")) return "production"; if(type.contains("库存")) return "inventory"; return "other";
    }
    private String titleForKey(String key) {
        switch(key){case "employees":return "👥 人事管理";case "attendance":return "🗓 考勤管理";case "salary":return "💴 工资管理";case "production":return "🏭 生产管理";case "inventory":return "📦 库存管理";default:return "其他记录";}
    }
    private void appendRecord(String key, String value) {
        String old = prefs.getString(key,""); prefs.edit().putString(key, old.isEmpty()?value:old+"\n\n────────\n\n"+value).apply();
    }
    private void showRecords(String title, String key) {
        shell(title,true); String data = prefs.getString(key,""); page.addView(text(data.isEmpty()?"暂无记录。可从拍照识别导入。":data,15,false),lp());
        Button add = button("＋ 拍照导入"); add.setOnClickListener(v -> showScan()); page.addView(add,lp());
    }

    private EditText input(String hint) { EditText e = new EditText(this); e.setHint(hint); return e; }
    private LinearLayout form(EditText... inputs) { LinearLayout l = new LinearLayout(this); l.setPadding(dp(16),0,dp(16),0); l.setOrientation(LinearLayout.VERTICAL); for(EditText e:inputs) l.addView(e,lp()); return l; }
    private void showAI() {
        shell("AI办公助手",true);
        Button notice=button("📢 写工作通知"); notice.setOnClickListener(v -> { EditText a=input("部门"),b=input("原因"),c=input("安排"); new AlertDialog.Builder(this).setTitle("生成通知").setView(form(a,b,c)).setPositiveButton("生成",(d,w)->showGenerated(OfficeTemplates.notice(a.getText().toString(),b.getText().toString(),c.getText().toString()))).setNegativeButton("取消",null).show(); }); page.addView(notice,lp());
        Button recruit=button("👷 写招聘文案"); recruit.setOnClickListener(v -> { EditText a=input("岗位"),b=input("人数"),c=input("薪资"),d=input("福利"); new AlertDialog.Builder(this).setTitle("生成招聘文案").setView(form(a,b,c,d)).setPositiveButton("生成",(x,w)->showGenerated(OfficeTemplates.recruit(a.getText().toString(),b.getText().toString(),c.getText().toString(),d.getText().toString()))).setNegativeButton("取消",null).show(); }); page.addView(recruit,lp());
        Button report=button("📋 生成生产日报"); report.setOnClickListener(v -> { EditText a=input("产线/班组"),b=input("计划数量"),c=input("完成数量"),d=input("异常说明"); new AlertDialog.Builder(this).setTitle("生产日报").setView(form(a,b,c,d)).setPositiveButton("生成",(x,w)->showGenerated(OfficeTemplates.dailyReport(a.getText().toString(),b.getText().toString(),c.getText().toString(),d.getText().toString()))).setNegativeButton("取消",null).show(); }); page.addView(report,lp());
    }
    private void showGenerated(String value) {
        shell("生成结果",true); TextView t=text(value,16,false); t.setTextIsSelectable(true); page.addView(t,lp());
        Button copy=button("复制内容"); copy.setOnClickListener(v -> { ((ClipboardManager)getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("AI办公助手",value)); Toast.makeText(this,"已复制",Toast.LENGTH_SHORT).show(); }); page.addView(copy,lp());
    }
}
