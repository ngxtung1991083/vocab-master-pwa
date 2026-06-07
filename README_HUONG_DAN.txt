VOCAB MASTER PWA OFFLINE V8 VOICE CONTROL FIX

BAN V4 CO GI MOI?
- Co mat khau khoa app.
- Tu dong doc khi sang tu moi.
- Chon ngon ngu doc: Trung / Viet / English / Trung->Viet / Trung->English / ca 3.
- Chon ngon ngu hien thi tren flashcard: Han tu / Pinyin / Tieng Viet / English.
- Tu dong hien nghia hoac an nghia.
- Tu dong sang tu tiep theo sau 2.5s / 4s / 6s / 8s.
- Import JSON.
- Import CSV.
- Import Excel .xlsx truc tiep tren trinh duyet.
- Quan ly nhieu bo tu vung.
- Flashcard theo bo tu vung va trang thai.
- Luyen thi.
- SRS on tap: Tu can on hom nay / tu da thuoc / tu chua thuoc / tu moi.
- Thong ke hoc tap.
- Backup / Restore JSON.
- Chay offline tren iPhone sau khi cai vao man hinh chinh.
- Khong can VPS.
- Khong can mo may tinh 24/24.
- Khong can App Store.

LUU Y VE IMPORT EXCEL:
File Excel nen co cac cot:
- Hán tự
- Pinyin
- Tiếng Việt
- English
- Deck

Neu khong co cot Deck, app se dua vao bo "Imported".

Ten cot chap nhan:
Hán tự / Hanzi / Chinese / 中文 / 汉字
Pinyin / 拼音
Tiếng Việt / Vietnamese / Viet / Nghĩa
English / EN / Tiếng Anh
Deck / Bộ / Bộ từ vựng / List

========================================
CAI LEN GITHUB PAGES
========================================
1. Giai nen ZIP.
2. Upload tat ca file va thu muc len repository GitHub Pages:
   - index.html
   - app.js
   - style.css
   - manifest.json
   - sw.js
   - xlsx.full.min.js
   - sample_vocab.json
   - sample_vocab.csv
   - icons/
3. Vao Settings -> Pages.
4. Source: Deploy from a branch.
5. Branch: main.
6. Folder: /(root).
7. Save.
8. Mo link GitHub Pages bang Safari tren iPhone.
9. Chia se -> Them vao Man hinh chinh.

========================================
CAP NHAT TU V2 LEN V3
========================================
Neu ban da upload V2 len GitHub:
- Upload de tat ca file V3 len repository cu.
- GitHub se tu deploy lai.
- Tren iPhone neu app chua cap nhat, dong app va mo lai.
- Neu van chua cap nhat, mo Safari vao link, refresh 2-3 lan.

========================================
BACKUP QUAN TRONG
========================================
Du lieu luu tren iPhone/Safari.
Neu xoa du lieu website Safari, du lieu co the mat.
Hay vao Quan Ly -> Export Backup de luu file backup vao iCloud Drive.


========================================
TINH NANG HOC MOI CUA V4
========================================
Trong tab Flashcard co phan "Hien thi & Tu doc":

1. Chon noi dung hien thi:
- Han tu
- Pinyin
- Tieng Viet
- English

2. Tu doc:
- Bat "Tu doc khi sang tu moi"
- Chon ngon ngu doc:
  Trung
  Viet
  English
  Trung -> Viet
  Trung -> English
  Trung -> Viet -> English

3. Tu dong hoc:
- Bat "Tu dong hien nghia" neu muon hien toan bo.
- Chon "Thoi gian tu sang tu tiep theo" neu muon app tu chay.


========================================
V5 SUA LOI VA NANG CAP
========================================
1. Sua loi import Excel:
- App se thu tai thu vien SheetJS khi co internet.
- Neu iPhone dang offline va thieu thu vien, hay luu file Excel thanh CSV roi import.
- File CSV van hoat dong rat nhe va on dinh.

2. Them nut "Hoc bai":
- Lan 1: doc mat truoc.
- Sau do tu lat mat sau va doc nghia theo ngon ngu ban chon.
- Lan tiep theo: sang tu moi.

3. Them nut "Tu dong":
- Bat/tat che do tu dong hoc.
- App tu doc, tu lat mat sau, tu sang tu tiep theo.
- Co the chinh thoi gian o phan "Thoi gian tu sang tu tiep theo".

4. Phim tat tren may tinh:
- H: Hoc bai
- A: Bat/tat Tu dong


========================================
V6 CLOUD SYNC - DONG BO GITHUB
========================================
Muc tieu:
- Import tu vung tren may tinh.
- Bam "Day len GitHub".
- Mo iPhone.
- Bam "Tai tu GitHub".
- iPhone co toan bo tu vung.

CAN CO:
1. GitHub repository dang chay app.
2. GitHub Fine-grained Personal Access Token.

TAO TOKEN:
1. Vao GitHub.
2. Bam avatar goc phai.
3. Settings.
4. Developer settings.
5. Personal access tokens.
6. Fine-grained tokens.
7. Generate new token.
8. Repository access: chon only repository vocab-master-pwa.
9. Permissions:
   - Contents: Read and write.
10. Generate token.
11. Copy token.

CAU HINH TRONG APP:
Vao Quan Ly -> Dong bo GitHub:
- GitHub username: ngxtung1991083
- Repository: vocab-master-pwa
- Branch: main
- File du lieu: data/vocab_sync.json
- Token: dan token GitHub vao
- Bam Luu cau hinh

QUY TRINH DUNG:
May tinh:
1. Import Excel / CSV / JSON.
2. Bam Day len GitHub.

iPhone:
1. Mo app.
2. Vao Quan Ly.
3. Bam Tai tu GitHub.
4. Du lieu se ve iPhone.

LUU Y BAO MAT:
- Token chi luu trong LocalStorage cua thiet bi ban nhap.
- Khong chia se token cho nguoi khac.
- Neu lo token, xoa token tren GitHub ngay.
- Voi PWA tinh, day la giai phap thuc dung mien phi, khong phai he thong bao mat doanh nghiep.


========================================
V7 SUA LOI HOC BAI / TU DONG
========================================
1. Nut "Hoc bai":
- Lan 1: hien/doc mat truoc.
- Lan 2: hien/doc mat sau.
- Lan 3: sang tu moi.
- Sau do lap lai chu ky.

2. Nut "Tu dong":
- Tu chay chu ky Hoc bai.
- Tu doc mat truoc.
- Tu lat sang mat sau.
- Tu doc mat sau.
- Tu sang tu moi.
- Co the chinh toc do o muc "Thoi gian tu chuyen buoc".

3. Lua chon rieng cho tung mat flashcard:
Mat truoc:
- Chon hien Han tu / Pinyin / Tieng Viet / English.
- Chon doc Han tu / Pinyin / Tieng Viet / English / Han tu -> Viet / Han tu -> English.

Mat sau:
- Chon hien Han tu / Pinyin / Tieng Viet / English.
- Chon doc Tieng Viet / English / Han tu / Han tu -> Viet / Han tu -> English / ca 3.


========================================
V8 SUA LOI LUA CHON / GIONG DOC
========================================
1. Them nut Xac Nhan:
- Xac Nhan Mat Truoc
- Xac Nhan Mat Sau
- Xac Nhan Cai Dat Hoc

Sau khi chon hien gi/doc gi, bam Xac Nhan de cap nhat ngay.

2. Giam thoi gian cho:
- Mac dinh khoang nghi giua ngon ngu = 0 ms.
- Khi bam doc ngon ngu moi, giong cu tu ngat ngay.

3. AI Voice Server:
- PWA offline khong tu chay Edge Neural TTS nhu laptop neu khong co server.
- V8 da them che do "AI Voice Server giong app laptop".
- Khi ban chay TTS server tren laptop/may chu noi bo, nhap URL vao o AI TTS Server URL.
- Server can nhan POST JSON: {text, lang}
- Server tra ve audio/mpeg hoac audio/wav.
- Neu server loi, app tu fallback ve giong iPhone/trinh duyet.
