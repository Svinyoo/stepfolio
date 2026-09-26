# ต้นฉบับคู่มือ Stepfolio ภาษาไทย

คู่มือรุ่น 1.0.1 จำนวน 12 หน้า A4 แนวนอน ภาพประกอบจาก UI ของโปรแกรม โดยใช้ข้อมูลตัวอย่าง ไม่มีภาพหน้าจอส่วนตัวของผู้ใช้งาน

- PDF พร้อมแจก: `../../output/pdf/Stepfolio-User-Guide-TH-1.0.1.pdf`
- `content.cjs`: เนื้อหาไทยและตำแหน่งภาพในแต่ละหน้า
- `manual.css`: รูปแบบและขนาดหน้ากระดาษ
- `images/`: ภาพหน้าจอ ความสัมพันธ์ของกรอบหมายเลข และตัวอย่างผลลัพธ์ PDF
- `example.stepfolio`: โครงการตัวอย่างสำหรับสร้างภาพคู่มือใหม่

## สร้าง PDF ใหม่

ติดตั้ง dependencies ด้วย `npm ci` แล้วรันบน Mac ที่มีฟอนต์ไทย:

```sh
node scripts/build-manual.cjs
```

คำสั่งสร้างไฟล์ HTML ชั่วคราวใน `tmp/pdfs/` ตรวจเนื้อหาล้นหน้า และพิมพ์ PDF ด้วย Chromium เพื่อรองรับรูปอักษรและวรรณยุกต์ไทย

## เก็บภาพหน้าจอใหม่ เมื่อหน้าตาโปรแกรมเปลี่ยน

```sh
mkdir -p tmp/pdfs
node scripts/capture-manual.cjs
pdftoppm -f 1 -l 2 -scale-to 1000 -png tmp/pdfs/sample-guide.pdf tmp/pdfs/sample
cp tmp/pdfs/sample-1.png docs/manual/images/sample-cover.png
cp tmp/pdfs/sample-2.png docs/manual/images/sample-step.png
node scripts/build-manual.cjs
```

การจับภาพใช้โหมดทดสอบของแอปและโครงการตัวอย่าง แถบลอยแสดงข้อมูลจำลอง 3 ขั้นตอน ไม่มีการเริ่มบันทึกหน้าจอจริง กระบวนการนี้เปิดหน้าต่างโปรแกรม จึงต้องทำใน desktop session ส่วน `pdftoppm` ต้องติดตั้ง Poppler

ตรวจ PDF ด้วยการ render ทุกหน้าเป็น PNG แล้วตรวจภาพ ข้อความ กรอบหมายเลข และเลขหน้าก่อนแจก:

```sh
pdftoppm -scale-to 1200 -png output/pdf/Stepfolio-User-Guide-TH-1.0.1.pdf tmp/pdfs/manual-page
```
