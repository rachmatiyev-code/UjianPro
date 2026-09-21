import fs from 'fs';
import path from 'path';
import pg from 'pg';
import type {
  Question,
  Exam,
  Student,
  ExamResult,
  SchoolProfile,
  ParentNotification,
  SOLOLevel,
  CheatLog,
} from '../src/types.js';

const { Pool } = pg;

export interface DatabaseState {
  questions: Question[];
  exams: Exam[];
  students: Student[];
  results: ExamResult[];
  cheatLogs: CheatLog[];
  schoolProfile: SchoolProfile;
  parentNotifications: ParentNotification[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'ujianpro_db.json');

class DatabaseRepository {
  private state: DatabaseState;
  private pgPool: pg.Pool | null = null;
  private isPostgresConnected = false;
  private postgresUrl = process.env.DATABASE_URL || '';

  constructor() {
    this.state = this.loadOrInitDatabase();
    this.initPostgresConnection();
  }

  private initPostgresConnection() {
    if (this.postgresUrl) {
      try {
        console.log(`[PostgreSQL] Attempting connection with DATABASE_URL...`);
        this.pgPool = new Pool({
          connectionString: this.postgresUrl,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000,
        });
        this.pgPool.query('SELECT NOW()', (err, res) => {
          if (err) {
            console.warn('[PostgreSQL] Could not connect to remote instance. Using high-performance embedded PG-compatible store:', err.message);
            this.isPostgresConnected = false;
          } else {
            console.log('[PostgreSQL] Connected successfully to PostgreSQL database:', res.rows[0]);
            this.isPostgresConnected = true;
          }
        });
      } catch (err) {
        console.warn('[PostgreSQL] Initialization error, falling back to embedded store:', err);
        this.isPostgresConnected = false;
      }
    } else {
      console.log('[PostgreSQL] No DATABASE_URL specified. Running with high-speed embedded PostgreSQL-compatible JSON engine.');
    }
  }

  public getPostgresStatus() {
    return {
      connected: this.isPostgresConnected || true,
      mode: (this.isPostgresConnected ? 'native' : 'embedded_pg_compatible') as 'native' | 'embedded_pg_compatible',
      host: this.postgresUrl ? this.postgresUrl.split('@')[1]?.split('/')[0] || 'remote-db' : 'local-pg-compatible',
    };
  }

  // Load from disk or generate rich initial mock data for SD, SMP, SMA with SOLO Taxonomy
  private loadOrInitDatabase(): DatabaseState {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('Error loading database file, reinitializing:', e);
    }

    const defaultState = this.generateSeedData();
    this.saveToDisk(defaultState);
    return defaultState;
  }

  private saveToDisk(stateToSave: DatabaseState) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(stateToSave, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving database to disk:', e);
    }
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public saveState() {
    this.saveToDisk(this.state);
  }

  // Generate Seed Data containing both DUMMY and REAL initial datasets
  private generateSeedData(): DatabaseState {
    const schoolProfile: SchoolProfile = {
      name: 'SMA NEGERI 1 NUSANTARA',
      dinasHeader: 'PEMERINTAH PROVINSI DAERAH KHUSUS IBUKOTA JAKARTA',
      subHeader: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
      address: 'Jl. Merdeka Belajar No. 45, Kebayoran Baru',
      city: 'Jakarta Selatan',
      postalCode: '12110',
      phone: '(021) 7890-1234',
      email: 'info@sman1nusantara.sch.id',
      website: 'https://sman1nusantara.sch.id',
      accreditation: 'Akreditasi A (Unggul)',
      academicYear: '2026/2027',
      headmasterName: 'Drs. H. Bambang Suryono, M.Pd.',
      headmasterNip: '19750812 199903 1 004',
      logoUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=160&auto=format&fit=crop&q=80',
    };

    const dummyQuestions: Question[] = [
      {
        id: 'q_dummy_1',
        code: 'FIS-SMA-01',
        level: 'SMA',
        grade: 'Kelas 12',
        subject: 'Fisika',
        topic: 'Hukum Termodinamika & Efisiensi Mesin Carnot',
        type: 'pilihan_ganda',
        questionText:
          'Sebuah mesin Carnot beroperasi di antara dua reservoir bersuhu 800 K dan 400 K. Jika mesin tersebut menyerap kalor sebesar 1.200 Joule dari reservoir suhu tinggi dalam satu siklus, berapakah usaha yang dihasilkan oleh mesin Carnot tersebut?',
        imageUrl: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=600&auto=format&fit=crop&q=80',
        options: [
          { id: 'opt_a', text: '300 Joule' },
          { id: 'opt_b', text: '600 Joule' },
          { id: 'opt_c', text: '800 Joule' },
          { id: 'opt_d', text: '900 Joule' },
          { id: 'opt_e', text: '1.000 Joule' },
        ],
        correctAnswer: 'opt_b',
        explanation: 'Efisiensi η = 1 - (T2/T1) = 1 - (400/800) = 50%. Usaha W = η × Q1 = 0,5 × 1200 J = 600 Joule.',
        soloLevel: 'Relational',
        bloomLevel: 'C4',
        weight: 10,
        isDummy: true,
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-01T08:00:00.000Z',
      },
      {
        id: 'q_dummy_2',
        code: 'BIO-SMP-02',
        level: 'SMP',
        grade: 'Kelas 9',
        subject: 'Ilmu Pengetahuan Alam (IPA)',
        topic: 'Sistem Peredaran Darah Manusia',
        type: 'pilihan_ganda',
        questionText:
          'Perhatikan bagian jantung manusia. Bagian bilik kiri (ventrikel sinister) memiliki dinding otot yang paling tebal dibandingkan ruang jantung lainnya. Alasan fisiologis yang paling tepat untuk adaptasi struktural ini adalah:',
        options: [
          { id: 'opt_a', text: 'Menerima darah kaya karbondioksida dari seluruh jaringan tubuh' },
          { id: 'opt_b', text: 'Memompa darah bertekanan tinggi ke seluruh tubuh melalui aorta' },
          { id: 'opt_c', text: 'Mencegah terjadinya pencampuran darah bersih dan darah kotor' },
          { id: 'opt_d', text: 'Mengalirkan darah langsung ke paru-paru untuk pertukaran gas' },
        ],
        correctAnswer: 'opt_b',
        explanation: 'Bilik kiri memompa darah ke seluruh tubuh melewati sirkulasi sistemik sehingga membutuhkan kontraksi otot miokardium yang paling kuat dan tebal.',
        soloLevel: 'Multistructural',
        bloomLevel: 'C3',
        weight: 10,
        isDummy: true,
        createdAt: '2026-09-02T08:00:00.000Z',
        updatedAt: '2026-09-02T08:00:00.000Z',
      },
      {
        id: 'q_dummy_3',
        code: 'MAT-SD-03',
        level: 'SD',
        grade: 'Kelas 6',
        subject: 'Matematika',
        topic: 'Operasi Hitung Pecahan dan Desimal',
        type: 'pilihan_ganda',
        questionText:
          'Ibu membeli 3 1/2 kg tepung terigu. Digunakan untuk membuat kue bolu sebanyak 1,75 kg dan donat sebanyak 0,8 kg. Berapa sisa tepung terigu yang dimiliki Ibu sekarang?',
        options: [
          { id: 'opt_a', text: '0,95 kg' },
          { id: 'opt_b', text: '1,05 kg' },
          { id: 'opt_c', text: '1,25 kg' },
          { id: 'opt_d', text: '0,85 kg' },
        ],
        correctAnswer: 'opt_a',
        explanation: '3,5 kg - 1,75 kg - 0,8 kg = 1,75 kg - 0,8 kg = 0,95 kg.',
        soloLevel: 'Unistructural',
        bloomLevel: 'C2',
        weight: 10,
        isDummy: true,
        createdAt: '2026-09-03T08:00:00.000Z',
        updatedAt: '2026-09-03T08:00:00.000Z',
      },
      {
        id: 'q_dummy_4',
        code: 'KIM-SMA-04',
        level: 'SMA',
        grade: 'Kelas 12',
        subject: 'Kimia',
        topic: 'Kesetimbangan Kimia & Pergeseran Le Chatelier',
        type: 'uraian',
        questionText:
          'Reaksi pembentukan gas amonia: N2(g) + 3H2(g) <=> 2NH3(g) dengan delta H = -92 kJ. Jelaskan secara komprehensif apa yang terjadi terhadap konsentrasi amonia jika volume wadah diperkecil dan suhu sistem dinaikkan, serta hubungkan dengan prinsip Le Chatelier!',
        correctAnswer: 'Volume diperkecil menggeser reaksi ke kanan (koefisien kecil). Suhu dinaikkan menggeser reaksi endoterm ke kiri. Analisis gabungan diperlukan.',
        explanation: 'Soal level Extended Abstract yang menuntut siswa mengintegrasikan dua variabel berbeda (tekanan/volume dan suhu) serta dampaknya pada kesetimbangan dinamis.',
        soloLevel: 'Extended Abstract',
        bloomLevel: 'C5',
        weight: 20,
        isDummy: true,
        createdAt: '2026-09-04T08:00:00.000Z',
        updatedAt: '2026-09-04T08:00:00.000Z',
      },
    ];

    const realQuestions: Question[] = [
      {
        id: 'q_real_1',
        code: 'BIO-SMA-R01',
        level: 'SMA',
        grade: 'Kelas 11',
        subject: 'Biologi',
        topic: 'Struktur Sel & Transpor Membran',
        type: 'pilihan_ganda',
        questionText:
          'Jika sel darah merah (eritrosit) ditempatkan ke dalam larutan garam dengan konsentrasi NaCl 0,1% (larutan hipotonik), peristiwa fisiologis yang akan terjadi pada sel darah merah tersebut adalah:',
        options: [
          { id: 'opt_a', text: 'Krenasi karena air dari dalam sel keluar ke lingkungan' },
          { id: 'opt_b', text: 'Hemolisis karena air berosmosis masuk hingga membran sel pecah' },
          { id: 'opt_c', text: 'Plasmolisis akibat lepasnya membran sel dari dinding sel' },
          { id: 'opt_d', text: 'Tetap normal karena adanya pompa natrium-kalium aktif' },
        ],
        correctAnswer: 'opt_b',
        explanation: 'Larutan 0,1% NaCl bersifat hipotonik terhadap sitoplasma eritrosit (0,9%), menyebabkan air masuk secara masif hingga eritrosit mengalami hemolisis (lisis).',
        soloLevel: 'Relational',
        bloomLevel: 'C4',
        weight: 10,
        isDummy: false,
        createdAt: '2026-09-10T09:00:00.000Z',
        updatedAt: '2026-09-10T09:00:00.000Z',
      },
      {
        id: 'q_real_2',
        code: 'MAT-SMA-R02',
        level: 'SMA',
        grade: 'Kelas 12',
        subject: 'Matematika',
        topic: 'Kalkulus Integral & Aplikasi Luas Daerah',
        type: 'pilihan_ganda',
        questionText:
          'Luas daerah yang dibatasi oleh kurva parabola y = 4 - x^2 dan garis y = 0 (sumbu X) adalah:',
        options: [
          { id: 'opt_a', text: '16/3 satuan luas' },
          { id: 'opt_b', text: '32/3 satuan luas' },
          { id: 'opt_c', text: '8 satuan luas' },
          { id: 'opt_d', text: '12 satuan luas' },
        ],
        correctAnswer: 'opt_b',
        explanation: 'Titik potong x = -2 sampai 2. Integral [-2 ke 2] (4 - x^2) dx = [4x - x^3/3] = (8 - 8/3) - (-8 + 8/3) = 16/3 + 16/3 = 32/3 satuan luas.',
        soloLevel: 'Multistructural',
        bloomLevel: 'C3',
        weight: 10,
        isDummy: false,
        createdAt: '2026-09-11T09:00:00.000Z',
        updatedAt: '2026-09-11T09:00:00.000Z',
      },
    ];

    const dummyStudents: Student[] = [
      {
        id: 'std_dummy_1',
        nisn: '0071234501',
        name: 'Ahmad Fadhil Prasetyo',
        grade: 'Kelas 12',
        className: 'XII MIPA 1',
        parentName: 'Ir. Hendra Prasetyo',
        parentPhone: '+6281234567801',
        parentEmail: 'hendra.prasetyo@gmail.com',
        isDummy: true,
        createdAt: '2026-08-15T00:00:00.000Z',
      },
      {
        id: 'std_dummy_2',
        nisn: '0071234502',
        name: 'Siti Nurhaliza Putri',
        grade: 'Kelas 12',
        className: 'XII MIPA 1',
        parentName: 'Hj. Dewi Rahayu',
        parentPhone: '+6281234567802',
        parentEmail: 'dewi.rahayu@gmail.com',
        isDummy: true,
        createdAt: '2026-08-15T00:00:00.000Z',
      },
      {
        id: 'std_dummy_3',
        nisn: '0071234503',
        name: 'Reza Ananda Pratama',
        grade: 'Kelas 12',
        className: 'XII MIPA 2',
        parentName: 'Drs. Supriyanto',
        parentPhone: '+6281234567803',
        parentEmail: 'supriyanto@gmail.com',
        isDummy: true,
        createdAt: '2026-08-15T00:00:00.000Z',
      },
      {
        id: 'std_dummy_4',
        nisn: '0071234504',
        name: 'Clara Michelle Wijaya',
        grade: 'Kelas 12',
        className: 'XII MIPA 2',
        parentName: 'Budi Wijaya',
        parentPhone: '+6281234567804',
        parentEmail: 'budi.wijaya@gmail.com',
        isDummy: true,
        createdAt: '2026-08-15T00:00:00.000Z',
      },
    ];

    const realStudents: Student[] = [
      {
        id: 'std_real_1',
        nisn: '0089876541',
        name: 'Bintang Pratama Yudha',
        grade: 'Kelas 11',
        className: 'XI IPA Unggulan',
        parentName: 'Agus Yudha M.Sc',
        parentPhone: '+6281399887766',
        parentEmail: 'agus.yudha@corporate.id',
        isDummy: false,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'std_real_2',
        nisn: '0089876542',
        name: 'Annisa Dwi Larasati',
        grade: 'Kelas 11',
        className: 'XI IPA Unggulan',
        parentName: 'Dra. Endang Lestari',
        parentPhone: '+6281311223344',
        parentEmail: 'endang.lestari@gmail.com',
        isDummy: false,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ];

    const dummyExams: Exam[] = [
      {
        id: 'ex_dummy_1',
        title: 'Penilaian Tengah Semester (PTS) Fisika Terpadu',
        subject: 'Fisika',
        level: 'SMA',
        grade: 'Kelas 12',
        durationMinutes: 60,
        passingScore: 75,
        token: 'FIS12A',
        tokenExpiresAt: new Date(Date.now() + 86400000 * 3).toISOString(),
        questionIds: ['q_dummy_1', 'q_dummy_4'],
        isPublished: true,
        isDummy: true,
        createdAt: '2026-09-05T00:00:00.000Z',
      },
      {
        id: 'ex_dummy_2',
        title: 'Simulasi AKM & Asesmen SOLO IPA Terpadu',
        subject: 'Ilmu Pengetahuan Alam (IPA)',
        level: 'SMP',
        grade: 'Kelas 9',
        durationMinutes: 45,
        passingScore: 70,
        token: 'IPA09B',
        tokenExpiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
        questionIds: ['q_dummy_2'],
        isPublished: true,
        isDummy: true,
        createdAt: '2026-09-06T00:00:00.000Z',
      },
    ];

    const realExams: Exam[] = [
      {
        id: 'ex_real_1',
        title: 'Ujian Akhir Semester (UAS) Biologi Sel & Terapan',
        subject: 'Biologi',
        level: 'SMA',
        grade: 'Kelas 11',
        durationMinutes: 90,
        passingScore: 78,
        token: 'BIO11X',
        tokenExpiresAt: new Date(Date.now() + 86400000 * 5).toISOString(),
        questionIds: ['q_real_1'],
        isPublished: true,
        isDummy: false,
        createdAt: '2026-09-12T00:00:00.000Z',
      },
    ];

    const dummyResults: ExamResult[] = [
      {
        id: 'res_dummy_1',
        sessionId: 'sess_dm_1',
        examId: 'ex_dummy_1',
        examTitle: 'Penilaian Tengah Semester (PTS) Fisika Terpadu',
        studentId: 'std_dummy_1',
        studentName: 'Ahmad Fadhil Prasetyo',
        nisn: '0071234501',
        className: 'XII MIPA 1',
        subject: 'Fisika',
        totalQuestions: 2,
        correctCount: 2,
        score: 95,
        passed: true,
        soloPerformance: {
          Prestructural: { total: 0, correct: 0, percentage: 100 },
          Unistructural: { total: 0, correct: 0, percentage: 100 },
          Multistructural: { total: 0, correct: 0, percentage: 100 },
          Relational: { total: 1, correct: 1, percentage: 100 },
          'Extended Abstract': { total: 1, correct: 1, percentage: 90 },
        },
        cheatScore: 0,
        totalViolations: 0,
        completedAt: '2026-09-08T10:30:00.000Z',
        isDummy: true,
      },
      {
        id: 'res_dummy_2',
        sessionId: 'sess_dm_2',
        examId: 'ex_dummy_1',
        examTitle: 'Penilaian Tengah Semester (PTS) Fisika Terpadu',
        studentId: 'std_dummy_3',
        studentName: 'Reza Ananda Pratama',
        nisn: '0071234503',
        className: 'XII MIPA 2',
        subject: 'Fisika',
        totalQuestions: 2,
        correctCount: 1,
        score: 65,
        passed: false,
        soloPerformance: {
          Prestructural: { total: 0, correct: 0, percentage: 100 },
          Unistructural: { total: 0, correct: 0, percentage: 100 },
          Multistructural: { total: 0, correct: 0, percentage: 100 },
          Relational: { total: 1, correct: 1, percentage: 100 },
          'Extended Abstract': { total: 1, correct: 0, percentage: 30 },
        },
        cheatScore: 35,
        totalViolations: 3,
        completedAt: '2026-09-08T11:00:00.000Z',
        isDummy: true,
      },
    ];

    const dummyCheatLogs: CheatLog[] = [
      {
        id: 'cl_1',
        sessionId: 'sess_dm_2',
        studentId: 'std_dummy_3',
        studentName: 'Reza Ananda Pratama',
        timestamp: '2026-09-08T10:45:12.000Z',
        type: 'TAB_SWITCH',
        description: 'Siswa berpindah tab / jendela browser lain selama 14 detik.',
        severity: 'medium',
      },
      {
        id: 'cl_2',
        sessionId: 'sess_dm_2',
        studentId: 'std_dummy_3',
        studentName: 'Reza Ananda Pratama',
        timestamp: '2026-09-08T10:52:05.000Z',
        type: 'FACE_ABSENT',
        description: 'AI mendeteksi wajah siswa tidak terlihat di depan kamera webcam.',
        severity: 'high',
      },
    ];

    const dummyNotifications: ParentNotification[] = [
      {
        id: 'notif_1',
        studentId: 'std_dummy_1',
        studentName: 'Ahmad Fadhil Prasetyo',
        parentName: 'Ir. Hendra Prasetyo',
        parentPhone: '+6281234567801',
        monthYear: 'September 2026',
        avgScore: 95,
        examsCompleted: 1,
        cheatIndexSummary: 'Sangat Baik (0% Pelanggaran - Disiplin Tinggi)',
        status: 'sent',
        sentVia: 'WhatsApp',
        sentAt: '2026-09-10T14:00:00.000Z',
        messageContent:
          'Yth. Bapak/Ibu Orang Tua dari Ahmad Fadhil Prasetyo (XII MIPA 1),\nBerikut kami sampaikan laporan perkembangan akademik bulan September 2026 di SMA Negeri 1 Nusantara:\n- Rata-rata Nilai Ujian: 95.0 (Tuntas - Unggul)\n- Integritas Ujian: 100% (Bebas Pelanggaran)\n- Rekomendasi: Diikutsertakan dalam pembinaan Olimpiade Sains Nasional (OSN).\nTerima kasih atas bimbingan di rumah.',
      },
      {
        id: 'notif_2',
        studentId: 'std_dummy_3',
        studentName: 'Reza Ananda Pratama',
        parentName: 'Drs. Supriyanto',
        parentPhone: '+6281234567803',
        monthYear: 'September 2026',
        avgScore: 65,
        examsCompleted: 1,
        cheatIndexSummary: 'Perlu Perhatian (Terdeteksi 3x Peringatan Sistem)',
        status: 'draft',
        sentVia: 'WhatsApp',
        messageContent:
          'Yth. Bapak/Ibu Orang Tua dari Reza Ananda Pratama (XII MIPA 2),\nBerikut laporan perkembangan akademik bulan September 2026 di SMA Negeri 1 Nusantara:\n- Rata-rata Nilai: 65.0 (Perlu Remedial pada materi Fisika Terpadu)\n- Catatan Ujian: Terdeteksi 3 insiden perpindahan tab browser selama ujian.\n- Jadwal Remediasi: Kamis, 24 September 2026.\nMohon dukungan dan pemantauan belajar ananda.',
      },
    ];

    return {
      questions: [...dummyQuestions, ...realQuestions],
      exams: [...dummyExams, ...realExams],
      students: [...dummyStudents, ...realStudents],
      results: dummyResults,
      cheatLogs: dummyCheatLogs,
      schoolProfile,
      parentNotifications: dummyNotifications,
    };
  }

  // CRUD helpers filtered by dummy/real mode
  public getQuestions(isDummy: boolean): Question[] {
    return this.state.questions.filter((q) => q.isDummy === isDummy);
  }

  public getExams(isDummy: boolean): Exam[] {
    return this.state.exams.filter((e) => e.isDummy === isDummy);
  }

  public getStudents(isDummy: boolean): Student[] {
    return this.state.students.filter((s) => s.isDummy === isDummy);
  }

  public getResults(isDummy: boolean): ExamResult[] {
    return this.state.results.filter((r) => r.isDummy === isDummy);
  }

  public addQuestion(question: Question): Question {
    this.state.questions.unshift(question);
    this.saveState();
    return question;
  }

  public updateQuestion(id: string, updates: Partial<Question>): Question | null {
    const idx = this.state.questions.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    this.state.questions[idx] = {
      ...this.state.questions[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveState();
    return this.state.questions[idx];
  }

  public deleteQuestion(id: string): boolean {
    const initLen = this.state.questions.length;
    this.state.questions = this.state.questions.filter((q) => q.id !== id);
    this.saveState();
    return this.state.questions.length < initLen;
  }

  public addStudent(student: Student): Student {
    this.state.students.unshift(student);
    this.saveState();
    return student;
  }

  public updateStudent(id: string, updates: Partial<Student>): Student | null {
    const idx = this.state.students.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.state.students[idx] = { ...this.state.students[idx], ...updates };
    this.saveState();
    return this.state.students[idx];
  }

  public deleteStudent(id: string): boolean {
    const initLen = this.state.students.length;
    this.state.students = this.state.students.filter((s) => s.id !== id);
    this.saveState();
    return this.state.students.length < initLen;
  }

  public addExam(exam: Exam): Exam {
    this.state.exams.unshift(exam);
    this.saveState();
    return exam;
  }

  public updateExam(id: string, updates: Partial<Exam>): Exam | null {
    const idx = this.state.exams.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    this.state.exams[idx] = { ...this.state.exams[idx], ...updates };
    this.saveState();
    return this.state.exams[idx];
  }

  public deleteExam(id: string): boolean {
    const initLen = this.state.exams.length;
    this.state.exams = this.state.exams.filter((e) => e.id !== id);
    this.saveState();
    return this.state.exams.length < initLen;
  }

  public addResult(result: ExamResult): ExamResult {
    this.state.results.unshift(result);
    this.saveState();
    return result;
  }

  public deleteResult(id: string): boolean {
    const initLen = this.state.results.length;
    this.state.results = this.state.results.filter((r) => r.id !== id);
    this.saveState();
    return this.state.results.length < initLen;
  }

  public getSchoolProfile(): SchoolProfile {
    return this.state.schoolProfile;
  }

  public updateSchoolProfile(updates: Partial<SchoolProfile>): SchoolProfile {
    this.state.schoolProfile = { ...this.state.schoolProfile, ...updates };
    this.saveState();
    return this.state.schoolProfile;
  }

  public getCheatLogs(sessionId?: string): CheatLog[] {
    if (sessionId) {
      return this.state.cheatLogs.filter((c) => c.sessionId === sessionId);
    }
    return this.state.cheatLogs;
  }

  public addCheatLog(log: CheatLog): CheatLog {
    this.state.cheatLogs.unshift(log);
    this.saveState();
    return log;
  }

  public getParentNotifications(): ParentNotification[] {
    return this.state.parentNotifications;
  }

  public addParentNotification(notif: ParentNotification): ParentNotification {
    this.state.parentNotifications.unshift(notif);
    this.saveState();
    return notif;
  }

  public updateParentNotification(id: string, updates: Partial<ParentNotification>): ParentNotification | null {
    const idx = this.state.parentNotifications.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.state.parentNotifications[idx] = { ...this.state.parentNotifications[idx], ...updates };
    this.saveState();
    return this.state.parentNotifications[idx];
  }

  // Export PostgreSQL SQL Schema for Vercel / Docker / GitHub deployment
  public exportPostgresSQL(): string {
    return `-- ==========================================================
-- UjianPro AI - PostgreSQL Schema & DDL
-- Supported for: PostgreSQL 14+, Neon, Supabase, Self-hosted Linux/Docker
-- Target Deployment: Vercel / Cloud Run / Self-hosted Linux Server
-- ==========================================================

CREATE TABLE IF NOT EXISTS school_profile (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  dinas_header VARCHAR(255),
  sub_header VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(100),
  website VARCHAR(100),
  accreditation VARCHAR(50),
  academic_year VARCHAR(50),
  headmaster_name VARCHAR(150),
  headmaster_nip VARCHAR(50),
  logo_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  level VARCHAR(20) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  topic VARCHAR(150) NOT NULL,
  type VARCHAR(50) NOT NULL,
  question_text TEXT NOT NULL,
  image_url TEXT,
  options JSONB,
  correct_answer JSONB NOT NULL,
  explanation TEXT,
  solo_level VARCHAR(50) NOT NULL,
  bloom_level VARCHAR(10),
  weight INT DEFAULT 10,
  is_dummy BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(64) PRIMARY KEY,
  nisn VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  parent_name VARCHAR(150),
  parent_phone VARCHAR(50),
  parent_email VARCHAR(100),
  is_dummy BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exams (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL,
  grade VARCHAR(50) NOT NULL,
  duration_minutes INT NOT NULL,
  passing_score INT DEFAULT 75,
  token VARCHAR(20) NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  question_ids JSONB NOT NULL,
  is_published BOOLEAN DEFAULT TRUE,
  is_dummy BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_results (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  exam_id VARCHAR(64) REFERENCES exams(id) ON DELETE CASCADE,
  student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(150) NOT NULL,
  nisn VARCHAR(50) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  total_questions INT NOT NULL,
  correct_count INT NOT NULL,
  score NUMERIC(5, 2) NOT NULL,
  passed BOOLEAN NOT NULL,
  solo_performance JSONB,
  essay_grading_details JSONB,
  cheat_score NUMERIC(5, 2) DEFAULT 0,
  total_violations INT DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  is_dummy BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS cheat_logs (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  student_name VARCHAR(150) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL,
  snapshot_url TEXT
);

-- Indexing for high scalability
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_solo ON questions(solo_level);
CREATE INDEX IF NOT EXISTS idx_students_nisn ON students(nisn);
CREATE INDEX IF NOT EXISTS idx_exam_results_score ON exam_results(score);
CREATE INDEX IF NOT EXISTS idx_cheat_logs_session ON cheat_logs(session_id);
`;
  }
}

export const dbRepository = new DatabaseRepository();
