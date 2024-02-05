import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Select from 'react-select';

const ExcelConverter = () => {
  const [initialData, setInitialData] = useState([]);
  const [options, setOptions] = useState({ 주소1: [], 주소2: [], 주소3: [] });
  const [selectedAddress, setSelectedAddress] = useState({ 주소1: '', 주소2: '', 주소3: '' });
  const [mapUrl, setMapUrl] = useState('');
  const [selectedData, setSelectedData] = useState(null);
  const [recentAddresses, setRecentAddresses] = useState([]);
  const [isMapExpanded, setIsMapExpanded] = useState(false);

  useEffect(() => {
    async function readExcelFile() {
      const filePath = '민원대행등록기관.xlsx';
      fetch(filePath)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
          const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).slice(1).map(row => ({
            주소1: row[4],
            주소2: row[5],
            주소3: row[6],
            A: row[0],
            B: row[1],
            C: row[2],
            D: row[3],
            E: row[4],
            F: row[5],
            G: row[6]
          }));

          setInitialData(jsonData);
          const 주소1Options = Array.from(new Set(jsonData.map(a => a.주소1))).map(a => ({ value: a, label: a }));
          setOptions(prev => ({ ...prev, 주소1: 주소1Options }));
        });
    }

    readExcelFile();
  }, []);

  useEffect(() => {
    if (selectedAddress.주소1) {
      const filteredData = initialData.filter(item => item.주소1 === selectedAddress.주소1);
      const 주소2Options = Array.from(new Set(filteredData.map(a => a.주소2))).map(a => ({ value: a, label: a }));
      setOptions(prev => ({ ...prev, 주소2: 주소2Options, 주소3: [] }));
    } else {
      setOptions(prev => ({ ...prev, 주소2: [], 주소3: [] }));
    }

    if (selectedAddress.주소2) {
      const filteredData = initialData.filter(item => item.주소1 === selectedAddress.주소1 && item.주소2 === selectedAddress.주소2);
      const 주소3Options = Array.from(new Set(filteredData.map(a => {
        // 주소3 옵션의 label에 기관명(B)을 추가하여 표시합니다.
        const labelWithB = `${a.주소3} - ${a.B}`; // 예: "주소3 - 기관명"
        return { value: a.주소3, label: labelWithB };
      })));
      setOptions(prev => ({ ...prev, 주소3: 주소3Options }));
    } else {
      setOptions(prev => ({ ...prev, 주소3: [] }));
    }
  }, [selectedAddress.주소1, selectedAddress.주소2, initialData]);

  useEffect(() => {
    const { 주소1, 주소2, 주소3 } = selectedAddress;
    if (주소1 && 주소2 && 주소3) {
      const fullAddress = `${주소1} ${주소2} ${주소3}`;
      const mapQuery = encodeURIComponent(fullAddress);
      const mapEmbedUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyAwLZpamGZON0FYfeHb1mSluu8xAeRBdXM&q=${mapQuery}`;
      setMapUrl(mapEmbedUrl);

      const selectedEntry = initialData.find(item => item.주소1 === 주소1 && item.주소2 === 주소2 && item.주소3 === 주소3);
      setSelectedData(selectedEntry || null); // 여기서 선택된 데이터가 없으면 null을 할당
      setRecentAddresses(prev => (selectedEntry ? [selectedEntry, ...prev.slice(0, 4)] : prev));
    }
  }, [selectedAddress, initialData]);

  const handleAddressChange = (selectedOption, { name }) => {
    setSelectedAddress(prevState => ({ ...prevState, [name]: selectedOption ? selectedOption.value : '' }));
  };

  const toggleMap = () => setIsMapExpanded(!isMapExpanded);

  const handleCopyToClipboard = () => {
    if (selectedData && selectedData.C) {
      navigator.clipboard.writeText(selectedData.D).then(() => {
        alert('주소가 클립보드에 복사되었습니다.');
      }, (err) => {
        console.error('클립보드 복사 실패:', err);
      });
    }
  };

  const downloadAsExcel = () => {
    const ws = XLSX.utils.json_to_sheet(recentAddresses.map((address, index) => ({
      ...address,
      순서: index + 1
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recent Addresses");
    XLSX.writeFile(wb, "recent_addresses.xlsx");
  };

  return (
    <div>
    <div>
        <h2>지역별 외국인 행정 등록기관 정보 보기(지도 포함)</h2>
    </div>
    <Select
        name="주소1"
        options={options.주소1}
        onChange={handleAddressChange}
        placeholder="주소1 선택..."
        value={options.주소1.find(option => option.value === selectedAddress.주소1)}
      />
      <Select
        name="주소2"
        options={options.주소2}
        onChange={handleAddressChange}
        placeholder="주소2 선택..."
        value={options.주소2.find(option => option.value === selectedAddress.주소2)}
        isDisabled={!selectedAddress.주소1}
      />
      <Select
        name="주소3"
        options={options.주소3}
        onChange={handleAddressChange}
        placeholder="주소3 선택..."
        value={options.주소3.find(option => option.value === selectedAddress.주소3)}
        isDisabled={!selectedAddress.주소2}
      />
  <div>
  <button onClick={toggleMap} style={{ marginBottom: "10px" }}>{isMapExpanded ? '지도 접기' : '지도 보기'}</button>
  </div>
  {isMapExpanded && mapUrl && <iframe
    width="600"
    height="450"
    style={{ border: 0 }}
    loading="lazy"
    allowFullScreen
    src={mapUrl}></iframe>}
  <div style={{height:"250px"}}>
  {selectedData ? (
    <div>
      <div>
        <span><h3>{selectedData.B}</h3></span>
        <span><h3>{selectedData.C}</h3></span>
        <span><h3>{selectedData.D}</h3></span>
      </div>
      <button onClick={handleCopyToClipboard} style={{margin: "10px 20px", padding: "10px 15px", cursor: "pointer"}}>
        전화번호 복사
      </button>
      <button style={{padding: "5px 15px"}}>
            <a href={`https://map.naver.com/?query=${encodeURIComponent(selectedData.C)}`} target="_blank" rel="noopener noreferrer" style={{ padding: "5px 15px", display: "inline-block", textDecoration: "none", backgroundColor: "#4CAF50", color: "white", borderRadius: "5px" }}>
              선택한 주소로 네이버 지도 바로 검색하기
            </a>
          </button>
        </div>
      ) : " 지역을 선택해주세요"}
  </div>
      {/* 최근 클릭한 주소 목록 */}
      <div style={{ marginTop: '20px' }}>
      <h3>최근 클릭한 주소</h3><p>저장 주소 개수: {recentAddresses.length}</p>
        {recentAddresses.length > 0 ? (
          <div>
            <button onClick={downloadAsExcel} style={{ margin: "10px 0", padding: "5px 15px", cursor: "pointer", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "5px" }}>
              Excel로 다운로드
            </button>
            <ul>
              {recentAddresses.map((address, index) => (
                <li key={index} style={{border: "1px solid black", listStyle:"none"}}>
                {/* 네이버 지도 링크 추가 */}
                <a href={`https://map.naver.com/?query=${encodeURIComponent(address.C)}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: "10px", textDecoration: "underline", color: "#007bff" }}>
                {index + 1} ) 네이버 지도로 보기
                </a>
                <div>{address.B}<br/>{address.C}</div>
                <div>전화번호: {address.D}, 연번: {address.A}, </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p>최근 클릭한 주소가 없습니다.</p>
        )}
      </div>
    </div>
  );
};

export default ExcelConverter;