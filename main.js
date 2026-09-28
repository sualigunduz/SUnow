let classes = [];
let currentDate = null;

const WEEKDAYS = ".MTWRF.";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
    if (!match) return null;
    
    let [, h, m, clk] = match;
    h = Number(h);
    m = Number(m);
    if (clk.toLowerCase() === "pm" && h !== 12) h += 12;
    if (clk.toLowerCase() === "am" && h === 12) h = 0;
    return h * 60 + m;
}

function getActiveSchedule(cls, date) {
    if (!Array.isArray(cls.schedule)) return null;
    const weekday = WEEKDAYS[date.getDay()];
    const slotStartMinutes = date.getHours() * 60 + 40; // Örn. saat 10 için 10:40

    return cls.schedule.find((sched) => {
        if (!sched?.days?.includes(weekday) || !sched?.where || !sched?.time?.from || !sched?.time?.to) {
            return false;
        }
        if (sched.where.startsWith("Altunizade Campus")) return false;

        // Tarih aralığı kontrolü (Günün son milisaniyesini kapsayacak şekilde)
        const fromDate = new Date(sched.dateRange.from);
        const toDate = new Date(sched.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (date < fromDate || date > toDate) return false;

        // Saat aralığı kontrolü: Ders slot başlangıcında aktif mi?
        const fromMin = parseTimeToMinutes(sched.time.from);
        const toMin = parseTimeToMinutes(sched.time.to);
        return fromMin <= slotStartMinutes && toMin > slotStartMinutes;
    });
}

function loadTimeSlot(date) {
    currentDate = date;

    const activeClasses = [];
    for (const cls of classes) {
        const sched = getActiveSchedule(cls, date);
        if (sched) {
            activeClasses.push({
                code: `${cls.subject} ${cls.code}${cls.type ?? ""}-${cls.section ?? "0"}`,
                where: sched.where,
                name: cls.name
            });
        }
    }

    activeClasses.sort((a, b) => a.code.localeCompare(b.code));

    // Tek seferde DOM güncelleme
    const listElem = document.getElementById("list");
    const rowsHtml = activeClasses.map((cls) => 
        `<tr><td>${cls.code}</td><td>${cls.where}</td><td>${cls.name}</td></tr>`
    ).join("");

    listElem.innerHTML = `<tr><th style="min-width: 120px">Code</th><th style="min-width: 120px">Where</th><th>Name</th></tr>${rowsHtml}`;

    const pad = (n) => n.toString().padStart(2, "0");
    const h = date.getHours();
    document.getElementById("current").innerText = 
        `[${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${DAY_NAMES[date.getDay()]} ${pad(h)}:40-${pad((h + 1) % 24)}:30]`;
}

function normalizeDate(date) {
    const d = new Date(date);
    if (d.getHours() >= 20) {
        d.setDate(d.getDate() + 1);
        d.setHours(8);
    }
    if (d.getDay() === 6) { // Cumartesi -> Pazartesi
        d.setDate(d.getDate() + 2);
        d.setHours(8);
    } else if (d.getDay() === 0) { // Pazar -> Pazartesi
        d.setDate(d.getDate() + 1);
        d.setHours(8);
    } else if (d.getMinutes() < 30) {
        d.setHours(d.getHours() - 1);
    }

    if (d.getHours() < 8) d.setHours(8);
    d.setMinutes(40, 0, 0);
    return d;
}

async function loadPage() {
    const currentElem = document.getElementById("current");
    try {
        const res = await fetch("202601.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        classes = await res.json();
        loadTimeSlot(normalizeDate(new Date()));
    } catch (err) {
        console.error("Veri yüklenemedi:", err);
        currentElem.innerText = "Ders verisi yüklenirken bir hata oluştu.";
    }
}

window.prevTimeslot = function() {
    if (!currentDate) return;
    currentDate.setHours(currentDate.getHours() - 1);
    if (currentDate.getHours() === 7) {
        currentDate.setHours(currentDate.getHours() - 12);
        if (currentDate.getDay() === 0) currentDate.setDate(currentDate.getDate() - 2);
    }
    loadTimeSlot(currentDate);
};

window.nextTimeslot = function() {
    if (!currentDate) return;
    currentDate.setHours(currentDate.getHours() + 1);
    if (currentDate.getHours() === 20) {
        currentDate.setHours(currentDate.getHours() + 12);
        if (currentDate.getDay() === 6) currentDate.setDate(currentDate.getDate() + 2);
    }
    loadTimeSlot(currentDate);
};

window.enableWrapChanged = function() {
    const enabled = document.getElementById("wrap").checked;
    document.getElementById("list").classList.toggle("nowrap", !enabled);
};

loadPage();
