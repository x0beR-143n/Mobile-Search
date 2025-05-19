// Thiết lập Express server với Algolia để thêm record từ ứng dụng Android
const express = require('express');
const bodyParser = require('body-parser');
const algoliasearch = require('algoliasearch');

require('dotenv').config();

// Khởi tạo express app
const app = express();
app.use(bodyParser.json());

// Khởi tạo Algolia client
const algoliaClient = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_API_KEY
);

// Chọn index để làm việc với
const propertyIndex = algoliaClient.initIndex('properties');

// API endpoint để thêm property vào Algolia
app.post('/api/properties', async (req, res) => {
  try {
    // Nhận dữ liệu từ client Android
    const searchProperty = req.body;
    
    // Điều chỉnh cấu trúc dữ liệu nếu cần
    const algoliaRecord = {
        objectID: searchProperty.objectID, // sử dụng propertyID làm objectID
        propertyName: searchProperty.propertyName,
        city_code: searchProperty.city_code,
        district_code: searchProperty.district_code,
        ward_code: searchProperty.ward_code,
        max_guest: searchProperty.max_guest,
        bed_rooms: searchProperty.bed_rooms,
        price: searchProperty.price,
        bookedDate: searchProperty.bookedDate,
        tv: searchProperty.tv,
        petAllowance: searchProperty.petAllowance,
        pool: searchProperty.pool,
        washingMachine: searchProperty.washingMachine,
        breakfast: searchProperty.breakfast,
        bbq: searchProperty.bbq,
        wifi: searchProperty.wifi,
        airConditioner: searchProperty.airConditioner
    };

    // Thêm record vào Algolia
    const result = await propertyIndex.saveObject(algoliaRecord);
    
    res.status(201).json({
      success: true,
      message: 'Property added to Algolia successfully',
      result: result
    });
  } catch (error) {
    console.error('Error adding property to Algolia:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add property to Algolia',
      error: error.message
    });
  }
});

// API endpoint để lấy property từ Algolia theo ID
app.get('/api/properties/:id', async (req, res) => {
  try {
    const propertyID = req.params.id;
    const property = await propertyIndex.getObject(propertyID);
    
    res.status(200).json({
      success: true,
      property: property
    });
  } catch (error) {
    console.error('Error fetching property from Algolia:', error);
    res.status(404).json({
      success: false,
      message: 'Property not found',
      error: error.message
    });
  }
});

app.delete('/api/properties/:id', async (req, res) => {
  try {
    const propertyID = req.params.id;
    
    // Xóa object từ Algolia
    const result = await propertyIndex.deleteObject(propertyID);
    
    res.status(200).json({
      success: true,
      message: 'Property deleted from Algolia successfully',
      result: result
    });
  } catch (error) {
    console.error('Error deleting property from Algolia:', error);
    res.status(500).json({
      success: false, 
      message: 'Failed to delete property from Algolia',
      error: error.message
    });
  }
});

app.post('/api/properties/search', async (req, res) => {
  try {
    // Nhận tham số tìm kiếm từ SearchField object
    const {
      propertyName,            // Tìm kiếm theo tên
      city_codes = [],         // Mảng city_code để lọc
      district_codes = [],     // Mảng district_code để lọc
      ward_codes = [],         // Mảng ward_code để lọc  
      max_guest,               // Lọc theo số khách tối đa
      bed_rooms,               // Lọc theo số phòng ngủ
      min_price,               // Lọc theo giá tối thiểu
      max_price,               // Lọc theo giá tối đa
      check_in_date,           // Ngày nhận phòng
      check_out_date,          // Ngày trả phòng
      tv,                      // Tiện ích TV
      petAllowance,            // Cho phép thú cưng
      pool,                    // Hồ bơi
      washingMachine,          // Máy giặt
      breakfast,               // Bữa sáng
      bbq,                     // BBQ
      wifi,                    // Wifi
      airConditioner,          // Điều hòa
      page = 0,                // Trang hiện tại
      hitsPerPage = 20         // Số kết quả mỗi trang
    } = req.body;

    // Xây dựng các bộ lọc
    let filters = [];
    
    // Thiết lập query string (tìm kiếm theo tên)
    // Nếu không có propertyName hoặc là chuỗi rỗng, sẽ tìm tất cả
    const query = propertyName || '';
    
    // Xử lý lọc theo city_codes, district_codes và ward_codes
    
    // Xử lý city_codes - sử dụng cú pháp Algolia chính xác hơn
    if (Array.isArray(city_codes) && city_codes.length > 0) {
      // Cách 1: Sử dụng để so sánh chính xác từng giá trị
      const cityFilter = city_codes.map(code => `city_code:${code}`).join(' OR ');
      if (cityFilter) filters.push(`(${cityFilter})`);
      
      // Cách 2 (thay thế): Sử dụng toán tử 'IN' của Algolia
      // filters.push(`city_code:${city_codes.join(' OR city_code:')}`);
    }
    
    // Xử lý district_codes - tách riêng ra khỏi city_codes
    if (Array.isArray(district_codes) && district_codes.length > 0) {
      const districtFilter = district_codes.map(code => `district_code:${code}`).join(' OR ');
      if (districtFilter) filters.push(`(${districtFilter})`);
    }
    
    // Xử lý ward_codes - tách riêng ra khỏi city_codes và district_codes
    if (Array.isArray(ward_codes) && ward_codes.length > 0) {
      const wardFilter = ward_codes.map(code => `ward_code:${code}`).join(' OR ');
      if (wardFilter) filters.push(`(${wardFilter})`);
    }
    
    // Lọc theo số khách và phòng ngủ - chỉ áp dụng nếu giá trị > 0
    if (max_guest && max_guest > 0) filters.push(`max_guest >= ${max_guest}`);
    if (bed_rooms && bed_rooms > 0) filters.push(`bed_rooms >= ${bed_rooms}`);
    
    // Lọc theo khoảng giá - chỉ áp dụng nếu giá trị > 0
    if (min_price && min_price > 0) filters.push(`price >= ${min_price}`);
    if (max_price && max_price > 0) filters.push(`price <= ${max_price}`);
    
    // Lọc theo tiện ích
    // Chỉ áp dụng filter cho các tiện ích được yêu cầu (có giá trị true)
    if (tv) filters.push('tv:true');
    if (petAllowance) filters.push('petAllowance:true');
    if (pool) filters.push('pool:true');
    if (washingMachine) filters.push('washingMachine:true');
    if (breakfast) filters.push('breakfast:true');
    if (bbq) filters.push('bbq:true');
    if (wifi) filters.push('wifi:true');
    if (airConditioner) filters.push('airConditioner:true');
    
    // Lọc theo ngày đặt (kiểm tra không trùng với bookedDate)
    if (check_in_date && check_out_date) {
      // Tạo mảng các ngày từ check_in_date đến check_out_date
      const startDate = new Date(check_in_date);
      const endDate = new Date(check_out_date);
      
      let currentDate = new Date(startDate);
      
      // Tạo filter phức tạp để đảm bảo không có ngày nào trong khoảng đã được đặt
      while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        filters.push(`NOT bookedDate:${dateString}`);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Tạo filter string từ mảng filters
    const filterStr = filters.length > 0 ? filters.join(' AND ') : '';
    console.log('Filter string:', filterStr);

    // Cấu hình tìm kiếm
    const searchParams = {
      filters: filterStr,
      page,
      hitsPerPage
    };

    // Thực hiện tìm kiếm
    const searchResults = await propertyIndex.search(query, searchParams);
    
    res.status(200).json({
      success: true,
      results: searchResults
    });
  } catch (error) {
    console.error('Error searching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search properties',
      error: error.message
    });
  }
});

app.get('/' , async (req, res) => {
  res.send("This is Search Property Server!")
})

// Cổng máy chủ
const PORT = process.env.PORT || 3000;
app.listen(PORT,'0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});