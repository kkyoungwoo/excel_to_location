import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import "./App.css"

// brevo 자동 이메일 발송 웹사이트
const mailservice = "brevo"

// #################### 설정 영역 - 필요시 수정 ####################
const BREVO_API_KEY = ''; // Brevo API 키
const FROM_EMAIL = 'rlaakfejd2@gmail.com'; // 발신자 이메일 (Brevo 인증 필요)
const BATCH_SIZE = 50; // 1회 발송량 (한 번에 보낼 이메일 수)
const DELAY_TIME = 2000; // 배치 간 지연 시간(ms)
// ##############################################################


// 이메일 유효성 검사 정규식
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 기본 HTML 제목 템플릿
const EMAIL_SUBJECT = "s외국인 근로자 고용 관련 미팅을 요청드립니다"; // 변수를 설정

// 기본 HTML 내용 템플릿
const defaultTemplate = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 50px 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
  <h1 style="color: #2a52be; font-size: 24px; text-align: left;">안녕하세요</h1>  
  <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 1px 5px rgba(0, 0, 0, 0.05); margin-top: 20px;">
    <p style="font-size: 16px; color: #333; text-align: left; line-height: 1.6;">

      (주)워크비자의 고경우 대표입니다.<br><br>

      워크비자는 외국인 근로자 채용을 도와주고 있는 기업입니다.<br><br>

      외국인 근로자 채용에 어려움을 겪고 계신 점에 깊이 공감하며, 해당 업종을 중심으로 외국인 합법 고용을 적극적으로 지원하고자 미팅을 요청드립니다.<br><br>

      아래는 현재 운영 중인 사이트 링크입니다:<br><br>

      <strong>외국인 인재풀 보기 "워크비자"</strong><br>
      <a href="https://workvisa.co.kr/" style="color: #2a52be; text-decoration: none;">https://workvisa.co.kr/</a><br><br>

      <strong>외국인 합법 채용 자가진단 사이트 "비자타입"</strong><br>
      클릭 6번으로 외국인을 합법적으로 채용할 수 있는지 확인 가능하며, 비용은 전혀 발생하지 않습니다.<br>
      <a href="https://visatype.co.kr/" style="color: #2a52be; text-decoration: none;">https://visatype.co.kr/</a><br><br>

      또한, 귀사에 적합한 외국인 인재를 맞춤형으로 소개해 드릴 수 있습니다.<br>
      워크비자에 등록된 인재들은 모두 현재 한국에 체류 중이며, 대부분 국내 대학을 졸업하고 한국어 의사소통에 능숙하여 업무 지시에도 문제가 없습니다.<br><br>

      추가적으로 궁금한 사항이나 문의가 있으시면 아래 연락처로 언제든지 연락 주시기 바랍니다.<br><br>

      감사합니다.
    </p>
  </div>
  
  <p style="font-size: 14px; color: #666; margin-top: 30px; text-align: left;">
<p style="font-size: 16px; color: #333; margin-top: 30px; text-align: left; line-height: 1.6; font-family: Arial, sans-serif;">
  <strong>Best Regards,</strong><br>
  (주)워크비자<br><br>
  고경우, Kyeongwoo Ko<br>
  Tel: <a href="tel:010-4242-3088" style="color: #1a73e8;">010-4242-3088</a><br>
  E-Mail: <a href="mailto:workvisahr@naver.com" style="color: #1a73e8;">workvisahr@naver.com</a><br>
</p>
  <div style="text-align: right; font-size: 12px; color: #999; margin-top: 40px;">
  </div>
</div>
`;

// ##############################################################

const spamKeywords = ['무료', '할인', '오늘만', '긴급', '보상'];

const containsSpamWords = (content) => {
  // content가 유효한지 확인
  if (typeof content !== 'string') {
    console.error("잘못된 콘텐츠 형식입니다.");
    return false;
  }
  return spamKeywords.some(word => content.includes(word));
};

// 오류 메시지 한국어 매핑
const ERROR_MESSAGES = {
  'Invalid email': '유효하지 않은 이메일 형식',
  'Sender not authenticated': '발신자 이메일 미등록',
  'Unauthorized': 'API 키 인증 실패',
  'Missing parameter': '필수 파라미터 누락'
};

function App() {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState(defaultTemplate);
  const [file, setFile] = useState(null);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({ 
    total: 0, 
    valid: 0, 
    invalid: 0, 
    duplicates: 0 
  });
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  // 효과 훅 업데이트
  useEffect(() => {
    if (!BREVO_API_KEY || !FROM_EMAIL) {
      alert('Brevo API 키와 발신자 이메일을 설정해주세요!');
    }
  }, []);

  // 샘플 CSV 생성
  const generateSampleCSV = () => {
    const sampleData = [
      ['이메일 주소', '담당자'],
      ['user1@example.com', '홍길동'],
      ['user2@example.com', '김철수'],
      ['invalid-email', '오류예제'],
      ['user1@example.com', '중복데이터']
    ].join('\n');
    
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 이메일 유효성 & 중복 검사
  const processEmails = (emails) => {
    const uniqueEmails = new Set();
    const duplicates = new Set();
    const validationResults = [];

    emails.forEach(({ email, name }) => {
      const trimmedEmail = email.trim();
      const isValid = emailRegex.test(trimmedEmail);
      
      if (uniqueEmails.has(trimmedEmail)) {
        duplicates.add(trimmedEmail);
        validationResults.push({ email: trimmedEmail, name, valid: false, duplicate: true });
      } else {
        uniqueEmails.add(trimmedEmail);
        validationResults.push({ 
          email: trimmedEmail, 
          name,
          valid: isValid,
          duplicate: false 
        });
      }
    });

    const valid = validationResults.filter(r => r.valid && !r.duplicate);
    const invalid = validationResults.filter(r => !r.valid);
    const duplicateCount = duplicates.size;

    return { valid, invalid, duplicateCount };
  };

  // CSV 파싱 및 즉시 검증
  const parseCSV = async (file) => {
    const reader = new FileReader();
    reader.readAsText(file);
    
    return new Promise((resolve) => {
      reader.onload = (e) => {
        const text = e.target.result;
        const rows = text.split(/\r?\n/).slice(1); // 줄바꿈 정규화
        const emails = rows
          .filter(row => row.trim())
          .map(row => {
            const [email, name] = row.split(',').map(cell => cell?.trim());
            return { email, name: name || '' };
          })
          .filter(r => r.email); // 이메일 없는 데이터 제거
  
        const { valid, invalid, duplicateCount } = processEmails(emails);
        setStats({
          total: emails.length,
          valid: valid.length,
          invalid: invalid.length,
          duplicates: duplicateCount
        });
  
        // 여기서 valid 배열의 각 객체를 렌더링 가능하도록 문자열로 변환
        //const validEmails = valid.map(v => v.email);
        //아래에꺼 또는 이걸로 진행!!resolve(validEmails);
        resolve(valid); // 전체 객체 반환
      };
    });
  };
   

  // 지연 처리 함수
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  // 배치 발송 시 Brevo의 배치 기능 활용
  const sendBatchEmails = async (batch) => {
    try {
        console.log("📌 배치 데이터 확인:", JSON.stringify(batch, null, 2));

        if (!Array.isArray(batch) || batch.length === 0) {
            throw new Error("배치 데이터가 비어있거나 배열이 아닙니다.");
        }

        // 이메일 수신자 리스트 생성
        const emailRequests = batch.map(({ email, name }) => {
            return axios.post(
                'https://api.brevo.com/v3/smtp/email',
                {
                    sender: { email: FROM_EMAIL },
                    to: [{ email }],
                    subject: EMAIL_SUBJECT.replace(/{담당자}/g, name || "고객님"),
                    htmlContent: content.replace(/{담당자}/g, name || "고객님")
                },
                {
                    headers: {
                        'api-key': BREVO_API_KEY,
                        'Content-Type': 'application/json'
                    }
                }
            );
        });

        // 모든 요청 실행
        const responses = await Promise.allSettled(emailRequests);

        // 결과 처리
        return responses.map((res, index) => ({
            email: batch[index].email,
            name: batch[index].name,
            status: res.status === 'fulfilled' ? '성공' : '실패',
            error: res.status === 'rejected' ? res.reason.response?.data?.message || res.reason.message : ''
        }));

    } catch (error) {
        console.error("❌ 이메일 발송 실패:", error.response?.data || error.message);

        return batch.map(({ email, name }) => ({
            email,
            name,
            status: '실패',
            error: error.response?.data?.message || error.message || '알 수 없는 오류'
        }));
    }
};


  // 전체 발송 프로세스
  const sendBulkEmails = async (emails) => {
    if (emails.length === 0) {
      alert("발송할 유효한 이메일이 없습니다.");
      return;
    }
  
    setLoading(true);
    const totalBatches = Math.ceil(emails.length / BATCH_SIZE);
    const results = [];
  
    for (let i = 0; i < totalBatches; i++) {
      let batch = emails.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
  
      // 🟢 이메일과 이름 모두 포함되도록 수정
      batch = batch.map(user => ({
        email: user.email,      // 이메일 추가
        name: user.name || "고객님"  // 이름 없으면 기본값 "고객님"
      }));
  
      console.log("📌 배치 데이터 확인:", JSON.stringify(batch, null, 2)); // 배치 데이터 확인
  
      // sendBatchEmails가 email을 정상적으로 받는지 확인
      const batchResults = await sendBatchEmails(batch);
      results.push(...batchResults);
  
      if (i < totalBatches - 1) {
        await delay(DELAY_TIME);
      }
    }
  
    setLoading(false);
    setIsSent(true);
    return results;
  };
  

  // 폼 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || isSent) return;
    
    try {
      const validEmails = await parseCSV(file);
      const sendResults = await sendBulkEmails(validEmails);
      setResults(sendResults.map(result => ({
        email: result.email,
        status: result.status,
        error: result.error || '-'
      })));
    } catch (error) {
      alert(`오류 발생: ${error.message}`);
    }
  };  

  // 결과 다운로드
  const downloadResults = () => {
    const worksheet = XLSX.utils.json_to_sheet(results.map(r => ({
      이메일: r.email,
      상태: r.status,
      오류내용: r.error || ''
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '결과');
    XLSX.writeFile(workbook, '발송결과.xlsx');
  };

  return (
    <div className="app-container email-dashboard">
      <div style={{display:"flex", justifyContent:"center", alignItems:"center"}}>
        <h1 className="main-title">{mailservice} 대량 이메일 발송 시스템</h1>
        <a style={{margin:"0 20px"}}href="/">새로고침</a>
      </div>
      <div className="notification-box warning-banner">
        <p className="warning-text">※ 주의사항: 발송은 1회만 가능하며, 재발송 시 페이지를 새로고침해야 합니다</p>
        <p className="warning-text">※ Brevo IP 풀 사용 (별도 화이트리스트 필요 없음)</p>
        <p className="warning-text">{BATCH_SIZE}개씩 {DELAY_TIME}초 마다 발송</p>
      </div>

      <div className="sample-section download-guide">
        <h3 className="section-subtitle">샘플 파일 다운로드</h3>
        <button className="btn secondary sample-download" onClick={generateSampleCSV}>
          CSV 샘플 다운로드
        </button>
        <p className="sample-instruction">
          * 첫 번째 열: 이메일 주소, 두 번째 열: 담당자
        </p>
      </div>

      <form className="email-form" onSubmit={handleSubmit}>
        <div className="form-group upload-section">
          <label className="form-label">CSV 파일 업로드 (첫번째 행 무시)</label>
          <input
            type="file"
            className="file-input"
            accept=".csv"
            onChange={async (e) => {
              const file = e.target.files[0];
              setFile(file);
              if (file) await parseCSV(file);
            }}
            disabled={isSent}
            required
          />
          {file && (
            <div className="upload-stats">
              <p className="stat-item">• 총 수신자: {stats.total}명</p>
              <p className="stat-item">• 유효 이메일: {stats.valid}명</p>
              {stats.invalid > 0 && <p className="stat-item error-stat">• 무효 이메일: {stats.invalid}명</p>}
              {stats.duplicates > 0 && <p className="stat-item warning-stat">• 중복 이메일: {stats.duplicates}건</p>}
            </div>
          )}
        </div>

        <div className="form-group subject-group">
          <label className="form-label">메일 제목: </label>
          <input
            type="text"
            className="subject-input"
            value={subject || EMAIL_SUBJECT} // 기본값으로 변수 사용
            onChange={e => setSubject(e.target.value)}
            required
            disabled={isSent}
          />
        </div>

        <div className="form-group editor-section">
          <div className="editor-controls">
            <button 
              type="button" 
              className="btn toggle-preview"
              onClick={() => setPreview(!preview)}
            >
              {preview ? '편집기 보기' : '미리보기'}
            </button>
            <span className="variable-info">
              사용 가능한 변수: {'{담당자}, {본문내용}'}
            </span>
          </div>
          
          {preview ? (
            <div
              className="preview-content"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div className="quill-wrapper">
              <ReactQuill
                className="rich-editor"
                theme="snow"
                value={content}
                onChange={setContent}
                modules={{
                  toolbar: [
                    ['bold', 'italic', 'underline'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                  ]
                }}
                readOnly={isSent}
              />
            </div>
          )}
        </div>

        <button 
          type="submit" 
          className={`btn primary submit-btn ${loading ? 'loading' : ''} ${isSent ? 'sent' : ''}`}
          disabled={loading || isSent}
        >
          {loading ? `발송 중 (${results.length}/${stats.valid})` : '이메일 발송'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="results-section">
          <h2 className="results-title">
            발송 결과 ({results.filter(r => r.status === '성공').length}/{results.length} 성공)
          </h2>
          <button className="btn download-results" onClick={downloadResults}>
            결과 다운로드 (Excel)
          </button>
          
          <div className="results-table-container">
            <table className="results-table">
              <thead className="table-header">
                <tr>
                  <th className="email-col">이메일</th>
                  <th className="status-col">상태</th>
                  <th className="error-col">오류 내용</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {results.map((result, index) => (
                  <tr 
                    key={index}
                    className={`table-row ${result.status === '성공' ? 'success-row' : 'error-row'}`}
                  >
                    <td className="email-cell">{result.email}</td>
                    <td className="status-cell">{result.status}</td>
                    <td className="error-cell">{result.error || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;