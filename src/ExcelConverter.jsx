import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Select from 'react-select';

const ExcelConverter = () => {
  const [initialData, setInitialData] = useState([]);
  const [options, setOptions] = useState({ 주소1: [], 주소2: [], 주소3: [] });
  const [selectedAddress, setSelectedAddress] = useState({ 주소1: '', 주소2: '', 주소3: '' });
  const [mapUrl, setMapUrl] = useState('');
  // 추가된 상태: 선택된 주소3에 대한 엑셀의 A~G 열 데이터 저장
  const [selectedData, setSelectedData] = useState(null);

  useEffect(() => {
    async function readExcelFile() {
      const filePath = '민원대행 등록기관(2024.01.31부).xlsx'; // 실제 경로로 조정 필요
      fetch(filePath)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
          const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).slice(1).map(row => ({
            주소1: row[4], // '주소1'은 5번째 열
            주소2: row[5], // '주소2'는 6번째 열
            주소3: row[6], // '주소3'는 7번째 열
            // 추가: A~G 열 데이터 저장
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
    }
    if (selectedAddress.주소2) {
      const filteredData = initialData.filter(item => item.주소1 === selectedAddress.주소1 && item.주소2 === selectedAddress.주소2);
      const 주소3Options = Array.from(new Set(filteredData.map(a => a.주소3))).map(a => ({ value: a, label: a }));
      setOptions(prev => ({ ...prev, 주소3: 주소3Options }));
    }
  }, [selectedAddress.주소1, selectedAddress.주소2, initialData]);

  useEffect(() => {
    const { 주소1, 주소2, 주소3 } = selectedAddress;
    if (주소1 && 주소2 && 주소3) {
      const fullAddress = `${주소1} ${주소2} ${주소3}`;
      const mapQuery = encodeURIComponent(fullAddress);
      const mapEmbedUrl = `https://www.google.com/maps/embed/v1/place?key=YOUR_API_KEY&q=${mapQuery}`;
      setMapUrl(mapEmbedUrl);
      
      // 주소3 선택 시 A~G 열 데이터 필터링 및 저장
      const selectedEntry = initialData.find(item => item.주소1 === 주소1 && item.주소2 === 주소2 && item.주소3 === 주소3);
      setSelectedData(selectedEntry);
    }
  }, [selectedAddress, initialData]);

  const handleAddressChange = (selectedOption, { name }) => {
    setSelectedAddress(prevState => ({ ...prevState, [name]: selectedOption ? selectedOption.value : '' }));
  };

  return (
    <div>
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
      {mapUrl && <iframe
        width="600"
        height="450"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        src={mapUrl}></iframe>}
      {selectedData && (
        <div>
          <p>연번: {selectedData.A}</p>
          <p>사업자 명: {selectedData.B}</p>
          <p>전체주소: {selectedData.C}</p>
          <p>전화번호: {selectedData.D}</p>
        </div>
      )}
    </div>
  );
};

export default ExcelConverter;
