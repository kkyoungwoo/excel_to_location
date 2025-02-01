import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

// #################### 설정 영역 - 필요시 수정 ####################
const SENDGRID_API_KEY = 'your_sendgrid_api_key'; // SendGrid API 키
const FROM_EMAIL = 'your_email@example.com'; // 발신자 이메일
const BATCH_SIZE = 100; // 1회 발송량 (한 번에 보낼 이메일 수)
const DELAY_TIME = 1000; // 배치 간 지연 시간(ms)
const SENDGRID_IP = '123.123.123.123'; // SendGrid 발송 IP (사용자 계정에서 확인 필요)
// ##############################################################

// 이메일 유효성 검사 정규식
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 기본 HTML 템플릿
const defaultTemplate = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #2a52be;">안녕하세요, {고객명}님!</h1>
  <p>저희 서비스를 이용해 주셔서 감사합니다.</p>
  <div style="background-color: #f4f4f4; padding: 20px; border-radius: 5px;">
    {본문내용}
  </div>
  <p style="color: #666; margin-top: 30px;">문의사항은 이 메일에 회신 부탁드립니다.</p>
  <p style="font-size: 12px; color: #999;">
    <a href="{{unsubscribe_url}}">수신 거부</a>
  </p>
</div>
`;

// 오류 메시지 한국어 매핑
const ERROR_MESSAGES = {
  'Invalid email address': '유효하지 않은 이메일 형식',
  'The from email does not contain a valid address': '발신자 이메일 오류',
  'You do not have permission to send mail': 'API 권한 문제',
  'Maximum number of recipients per message exceeded': '수신자 수 초과'
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

  useEffect(() => {
    if (!SENDGRID_API_KEY || !FROM_EMAIL) {
      alert('SendGrid API 키와 발신자 이메일을 설정해주세요!');
    }
  }, []);

  // 샘플 CSV 생성
  const generateSampleCSV = () => {
    const sampleData = [
      ['이메일 주소', '고객명'],
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
        const rows = text.split('\n').slice(1); // 헤더 제거
        const emails = rows.map(row => {
          const [email, name] = row.split(',').map(cell => cell?.trim());
          return { email, name: name || '' };
        }).filter(r => r.email); // 빈 행 제거

        const { valid, invalid, duplicateCount } = processEmails(emails);
        setStats({
          total: emails.length,
          valid: valid.length,
          invalid: invalid.length,
          duplicates: duplicateCount
        });
        resolve(valid);
      };
    });
  };

  // 지연 처리 함수
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  // 배치 발송 처리
  const sendBatchEmails = async (batch) => {
    return Promise.all(batch.map(async ({ email, name }) => {
      try {
        const personalizedContent = content
          .replace(/{고객명}/g, name)
          .replace(/{본문내용}/g, content);

        await axios.post('https://api.sendgrid.com/v3/mail/send', {
          personalizations: [{ to: [{ email }] }],
          from: { email: FROM_EMAIL },
          subject,
          content: [{ type: 'text/html', value: personalizedContent }]
        }, {
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        return { email, status: '성공', error: '' };
      } catch (error) {
        const message = error.response?.data?.errors?.[0]?.message || error.message;
        return { 
          email, 
          status: '실패', 
          error: ERROR_MESSAGES[message] || `발송 오류: ${message}` 
        };
      }
    }));
  };

  // 전체 발송 프로세스
  const sendBulkEmails = async (emails) => {
    setLoading(true);
    const totalBatches = Math.ceil(emails.length / BATCH_SIZE);
    const results = [];

    for (let i = 0; i < totalBatches; i++) {
      const batch = emails.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
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
      setResults(sendResults);
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
    <div className="app-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 className="section-title">대량 이메일 발송 시스템</h1>
      <div className="warning-box" style={{ color: 'red', margin: '15px 0' }}>
        <p>※ 주의사항: 발송은 1회만 가능하며, 재발송 시 페이지를 새로고침해야 합니다</p>
        <p>※ 발송 IP: {SENDGRID_IP} (스팸 필터 허용 필요)</p>
      </div>

      {/* 샘플 CSV 다운로드 섹션 */}
      <div className="sample-section" style={{ margin: '20px 0', padding: '15px', background: '#f8f9fa' }}>
        <h3>샘플 파일 다운로드</h3>
        <button className="action-button secondary-button" onClick={generateSampleCSV}>CSV 샘플 다운로드</button>
        <p style={{ fontSize: '0.9em', color: '#666' }}>
          * 첫 번째 열: 이메일 주소, 두 번째 열: 고객명
        </p>
      </div>

      {/* 발송 폼 섹션 */}
      <form onSubmit={handleSubmit} style={{ margin: '30px 0' }}>
        <div style={{ marginBottom: '15px' }}>
          <label>CSV 파일 업로드: </label>
          <input 
            type="file" 
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
            <div style={{ marginTop: '10px' }}>
              <p>• 총 수신자: {stats.total}명</p>
              <p>• 유효 이메일: {stats.valid}명</p>
              {stats.invalid > 0 && <p style={{ color: 'red' }}>• 무효 이메일: {stats.invalid}명</p>}
              {stats.duplicates > 0 && <p style={{ color: 'orange' }}>• 중복 이메일: {stats.duplicates}건</p>}
            </div>
          )}
        </div>

        {/* 메일 제목/내용 입력 */}
        <div style={{ marginBottom: '15px' }}>
          <label>메일 제목: </label>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            style={{ width: '100%', padding: '8px' }}
            required
            disabled={isSent}
          />
        </div>

        {/* 에디터/미리보기 섹션 */}
        <div style={{ marginBottom: '15px' }}>
          <div style={{ marginBottom: '10px' }}>
            <button type="button" onClick={() => setPreview(!preview)}>
              {preview ? '편집기 보기' : '미리보기'}
            </button>
            <span style={{ marginLeft: '10px', color: '#666' }}>
              사용 가능한 변수: {'{고객명}, {본문내용}'}
            </span>
          </div>
          
          {preview ? (
            <div
              dangerouslySetInnerHTML={{ __html: content }}
              style={{
                border: '1px solid #ccc',
                padding: '20px',
                borderRadius: '5px',
                minHeight: '300px'
              }}
            />
          ) : (
            <ReactQuill
              theme="snow"
              value={content}
              onChange={setContent}
              style={{ height: '400px', marginBottom: '40px' }}
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
          )}
        </div>

        <button 
          type="submit" 
          disabled={loading || isSent} 
          style={{ 
            padding: '10px 20px',
            background: isSent ? '#ccc' : '#2a52be',
            color: 'white'
          }}
        >
          {loading ? `발송 중 (${results.length}/${stats.valid})` : '이메일 발송'}
        </button>
      </form>

      {/* 결과 섹션 */}
      {results.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h2>발송 결과 ({results.filter(r => r.status === '성공').length}/{results.length} 성공)</h2>
          <button onClick={downloadResults}>결과 다운로드 (Excel)</button>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto', marginTop: '15px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>이메일</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>상태</th>
                  <th style={{ padding: '10px', border: '1px solid #ddd' }}>오류 내용</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{result.email}</td>
                    <td style={{ 
                      padding: '10px', 
                      border: '1px solid #ddd',
                      color: result.status === '성공' ? 'green' : 'red'
                    }}>
                      {result.status}
                    </td>
                    <td style={{ padding: '10px', border: '1px solid #ddd' }}>{result.error || '-'}</td>
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