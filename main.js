let classes = [];
let currentDate = null;

const WEEKDAYS = ".MTWRF.";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Saat dizesini gün içi dakikaya çevirir (Örn: "1:40 pm" -> 820)
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

// Belirtilen dersin seçili saatte aktif olup olmadığını kontrol eder
function getActiveSchedule(cls, date) {
    if (!Array.isArray(cls.schedule)) return null;
    const weekday = WEEKDAYS[date.getDay()];
    const slotStartMinutes = date.getHours() * 60 + 40; // xx:40 başlangıcı

    return cls.schedule.find((sched) => {
        if (!sched?.days?.includes(weekday) || !sched?.where || !sched?.time?.from || !sched?.time?.to) {
            return false;
        }
        if (sched.where.startsWith("Altunizade Campus")) return false;

        const fromDate = new Date(sched.dateRange.from);
        const toDate = new Date(sched.dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        if (date < fromDate || date > toDate) return false;

        const fromMin = parseTimeToMinutes(sched.time.from);
        const toMin = parseTimeToMinutes(sched.time.to);
        return fromMin <= slotStartMinutes && toMin > slotStartMinutes;
    });
}

// Tabloyu filtreleri uygulayarak çizer
function renderList() {
    if (!currentDate) return;

    const building = document.getElementById("building-filter")?.value || "";
    const codeQuery = (document.getElementById("code-filter")?.value || "").trim().toUpperCase();
    const hideRoute = document.getElementById("hide-route")?.checked ?? false;

    const activeClasses = [];
    for (const cls of classes) {
        // Route (AL veya ENG) gizleme filtresi
        if (hideRoute && (cls.subject === "AL" || cls.subject === "ENG")) {
            continue;
        }

        // Bölüm/Kod arama filtresi (örn: "CS", "300")
        if (codeQuery && !cls.subject.toUpperCase().includes(codeQuery) && !`${cls.code}`.includes(codeQuery)) {
            continue;
        }

        const sched = getActiveSchedule(cls, currentDate);
        if (sched) {
            // Bina filtresi (FENS, FASS, FMAN, UC)
            if (building && !sched.where.startsWith(building)) {
                continue;
            }

            activeClasses.push({
                code: `${cls.subject} ${cls.code}${cls.type ?? ""}-${cls.section ?? "0"}`,
                where: sched.where,
                name: cls.name
            });
        }
    }

    activeClasses.sort((a, b) => a.code.localeCompare(b.code));

    const listElem = document.getElementById("list");
    if (activeClasses.length === 0) {
        listElem.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 24px; color: #6b7280;">Bu saat aralığında veya kriterlerde aktif ders bulunamadı.</td></tr>`;
        return;
    }

    const rowsHtml = activeClasses.map((cls) => 
        `<tr>
            <td class="col-code">${cls.code}</td>
            <td class="col-where">${cls.where}</td>
            <td class="col-name">${cls.name}</td>
        </tr>`
    ).join("");

    listElem.innerHTML = `
        <thead>
            <tr>
                <th class="col-code">Code</th>
                <th class="col-where">Where</th>
                <th class="col-name">Name</th>
            </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
    `;
}

function loadTimeSlot(date) {
    currentDate = date;
    const pad = (n) => n.toString().padStart(2, "0");
    const h = date.getHours();
    
    document.getElementById("current").innerText = 
        `[${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${DAY_NAMES[date.getDay()]} ${pad(h)}:40-${pad((h + 1) % 24)}:30]`;

    renderList();
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
        // Orijinal canlı veri adresi
        const res = await fetch("https://omerrifat.github.io/bannerweb-fetch/dist/202601.json", { cache: "no-cache" }); //[cite: 1]
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        classes = await res.json();
        loadTimeSlot(normalizeDate(new Date()));
    } catch (err) {
        console.error("Veri yüklenemedi:", err);
        currentElem.innerText = "Ders verisi yüklenirken hata oluştu.";
    }
}

// Buton ve input olayları (window objesine doğrudan atanır)
window.filterChanged = function() {
    renderList();
};

window.enableWrapChanged = function() {
    const enabled = document.getElementById("wrap")?.checked;
    document.getElementById("list").classList.toggle("nowrap", !enabled);
};

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

loadPage();
