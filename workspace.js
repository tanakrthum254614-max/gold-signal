// Presentation only: section headings, current-page semantics and the local date.
(function () {
  const sections = {
    home: ['MARKET OVERVIEW', 'ภาพรวมตลาดทองคำ', 'ติดตามราคาสด แนวโน้ม และสัญญาณซื้อขายในที่เดียว', 'ภาพรวมตลาด'],
    stats: ['ECONOMIC INSIGHTS', 'ข่าวและเศรษฐกิจสหรัฐ', 'ปฏิทินเศรษฐกิจ ข่าวสำคัญ และข้อมูลที่มีผลกับทองคำ', 'ข่าวสหรัฐ'],
    chart: ['CHART WORKSPACE', 'กราฟและจุดเข้าซื้อขาย', 'วิเคราะห์ทุกกรอบเวลา พร้อมจุดเข้า จุดตัดขาดทุน และเป้าหมาย', 'กราฟ'],
    zframes: ['US MARKET', 'ภาพรวมตลาดหุ้นสหรัฐ', 'ติดตามดัชนี หุ้น และภาพรวมการลงทุน', 'หุ้นสหรัฐ'],
    account: ['PREFERENCES', 'ตั้งค่าพื้นที่ทำงาน', 'ปรับหน้าจอและค่าที่ใช้คำนวณให้เหมาะกับการใช้งานของคุณ', 'ตั้งค่า'],
  };
  function update() {
    const key = location.hash.slice(1);
    const [eyebrow, title, description, label] = sections[key] || sections.home;
    document.getElementById('wsEyebrow').textContent = eyebrow;
    document.getElementById('wsTitle').textContent = title;
    document.getElementById('wsDescription').textContent = description;
    document.getElementById('wsCurrent').textContent = label;
    document.querySelectorAll('#tabbar > a[data-tab]').forEach(a => {
      if (a.dataset.tab === (sections[key] ? key : 'home')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.getElementById('wsChartLink').hidden = key === 'chart';
  }
  const date = document.getElementById('wsDate');
  const now = new Date();
  date.dateTime = new Intl.DateTimeFormat('en-CA', {year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Bangkok'}).format(now);
  date.textContent = new Intl.DateTimeFormat('th-TH', {day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'}).format(now);
  update();
  addEventListener('hashchange', update);
  document.querySelector('.ws-skip').addEventListener('click', event => {
    event.preventDefault();
    const main = document.getElementById('mainContent');
    main.focus({preventScroll: true});
    main.scrollIntoView({block: 'start'});
  });
})();
