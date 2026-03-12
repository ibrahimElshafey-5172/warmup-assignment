const fs = require("fs");
 



function timeToSeconds(timeStr) {
    timeStr = timeStr.trim().replace(/\r/g, ""); // strip Windows \r
    let isPM = false;
    let isAM = false;
    if (timeStr.toLowerCase().endsWith("pm")) {
        isPM = true;
        timeStr = timeStr.slice(0, -2).trim();
    } else if (timeStr.toLowerCase().endsWith("am")) {
        isAM = true;
        timeStr = timeStr.slice(0, -2).trim();
    }
    let parts = timeStr.split(":");
    let h = parseInt(parts[0]);
    let m = parseInt(parts[1]);
    let s = parseInt(parts[2]);
    if (isPM && h !== 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 3600 + m * 60 + s;
}


function secondsToTime(totalSeconds) {
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;
    let mm = String(m).padStart(2, "0");
    let ss = String(s).padStart(2, "0");
    return `${h}:${mm}:${ss}`;
} 

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    let startSec = timeToSeconds(startTime);
    let endSec = timeToSeconds(endTime);
    let diff = endSec - startSec;
    if (diff < 0) diff += 24 * 3600;
    return secondsToTime(diff);
} 
// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    const deliveryStart = 8 * 3600;   // 8:00 AM in seconds
    const deliveryEnd   = 22 * 3600;  // 10:00 PM in seconds
    const DAY           = 24 * 3600;

    let startSec = timeToSeconds(startTime);
    let endSec   = timeToSeconds(endTime);

    // Handle overnight shifts
    if (endSec < startSec) endSec += DAY;

    let idleBefore = 0;
    let idleAfter  = 0;

    if (startSec < deliveryStart) {
        idleBefore = Math.min(deliveryStart, endSec) - startSec;
        if (idleBefore < 0) idleBefore = 0;
    }

    if (endSec > deliveryEnd) {
        idleAfter = endSec - Math.max(deliveryEnd, startSec);
        if (idleAfter < 0) idleAfter = 0;
    }

    return secondsToTime(idleBefore + idleAfter);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    let shiftSec = timeToSeconds(shiftDuration);
    let idleSec  = timeToSeconds(idleTime);
    return secondsToTime(shiftSec - idleSec);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    const eidStart  = new Date("2025-04-10");
    const eidEnd    = new Date("2025-04-30");
    const checkDate = new Date(date);

    let quotaSec;
    if (checkDate >= eidStart && checkDate <= eidEnd) {
        quotaSec = 6 * 3600;
    } else {
        quotaSec = 8 * 3600 + 24 * 60;
    }

    let activeSec = timeToSeconds(activeTime);
    return activeSec >= quotaSec;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    let content = fs.readFileSync(textFile, { encoding: "utf8" });
    let lines = content.split("\n").filter(l => l.trim() !== "");

    for (let line of lines) {
        let cols = line.split(",");
        if (cols[0].trim() === shiftObj.driverID && cols[2].trim() === shiftObj.date) {
            return {};
        }
    }

    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime      = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime    = getActiveTime(shiftDuration, idleTime);
    let quota         = metQuota(shiftObj.date, activeTime);
    let hasBonus      = false;

    let newRecord = {
        driverID:      shiftObj.driverID,
        driverName:    shiftObj.driverName,
        date:          shiftObj.date,
        startTime:     shiftObj.startTime,
        endTime:       shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime:      idleTime,
        activeTime:    activeTime,
        metQuota:      quota,
        hasBonus:      hasBonus
    };

    let newLine = `${newRecord.driverID},${newRecord.driverName},${newRecord.date},${newRecord.startTime},${newRecord.endTime},${newRecord.shiftDuration},${newRecord.idleTime},${newRecord.activeTime},${newRecord.metQuota},${newRecord.hasBonus}`;

    let lastIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].split(",")[0].trim() === shiftObj.driverID) {
            lastIndex = i;
        }
    }

    if (lastIndex === -1) {
        lines.push(newLine);
    } else {
        lines.splice(lastIndex + 1, 0, newLine);
    }

    fs.writeFileSync(textFile, lines.join("\n") + "\n", { encoding: "utf8" });
    return newRecord;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    let content = fs.readFileSync(textFile, { encoding: "utf8" });
    let lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === "") continue;
        let cols = lines[i].split(",");
        if (cols[0].trim() === driverID && cols[2].trim() === date) {
            cols[9] = newValue.toString();
            lines[i] = cols.join(",");
            break;
        }
    }

    fs.writeFileSync(textFile, lines.join("\n"), { encoding: "utf8" });
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
    let content = fs.readFileSync(textFile, { encoding: "utf8" });
    let lines = content.split("\n").filter(l => l.trim() !== "");

    let normalizedMonth = parseInt(month);
    let found = false;
    let count = 0;

    for (let line of lines) {
        let cols = line.split(",");
        if (cols[0].trim() === driverID) {
            found = true;
            let recordMonth = parseInt(cols[2].trim().split("-")[1]);
            if (recordMonth === normalizedMonth) {
                if (cols[9].trim() === "true") {
                    count++;
                }
            }
        }
    }

    return found ? count : -1;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let content = fs.readFileSync(textFile, { encoding: "utf8" });
    let lines = content.split("\n").filter(l => l.trim() !== "");

    let totalSeconds = 0;

    for (let line of lines) {
        let cols = line.split(",");
        if (cols[0].trim() !== driverID) continue;
        let recordMonth = parseInt(cols[2].trim().split("-")[1]);
        if (recordMonth !== month) continue;
        totalSeconds += timeToSeconds(cols[7].trim());
    }

    return secondsToTime(totalSeconds);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    let rateContent = fs.readFileSync(rateFile, { encoding: "utf8" });
    let rateLines = rateContent.split("\n").filter(l => l.trim() !== "");
    let dayOff = null;
    for (let line of rateLines) {
        let cols = line.split(",");
        if (cols[0].trim() === driverID) {
            dayOff = cols[1].trim();
            break;
        }
    }

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const eidStart = new Date("2025-04-10");
    const eidEnd   = new Date("2025-04-30");

    let shiftContent = fs.readFileSync(textFile, { encoding: "utf8" });
    let shiftLines = shiftContent.split("\n").filter(l => l.trim() !== "");

    let totalRequiredSeconds = 0;

    for (let line of shiftLines) {
        let cols = line.split(",");
        if (cols[0].trim() !== driverID) continue;
        let dateStr = cols[2].trim();
        if (parseInt(dateStr.split("-")[1]) !== month) continue;

        let recordDate = new Date(dateStr);
        if (dayNames[recordDate.getDay()] === dayOff) continue;

        if (recordDate >= eidStart && recordDate <= eidEnd) {
            totalRequiredSeconds += 6 * 3600;
        } else {
            totalRequiredSeconds += 8 * 3600 + 24 * 60;
        }
    }

    totalRequiredSeconds = Math.max(0, totalRequiredSeconds - bonusCount * 2 * 3600);
    return secondsToTime(totalRequiredSeconds);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
     let rateContent = fs.readFileSync(rateFile, { encoding: "utf8" });
    let rateLines = rateContent.split("\n").filter(l => l.trim() !== "");
    let basePay = 0;
    let tier = 0;
    for (let line of rateLines) {
        let cols = line.split(",");
        if (cols[0].trim() === driverID) {
            basePay = parseInt(cols[2].trim());
            tier    = parseInt(cols[3].trim());
            break;
        }
    }

    const allowedMissingHours = { 1: 50, 2: 20, 3: 10, 4: 3 };
    let allowed = allowedMissingHours[tier] || 0;

    let actualSec   = timeToSeconds(actualHours);
    let requiredSec = timeToSeconds(requiredHours);

    if (actualSec >= requiredSec) return basePay;

    let missingHours = (requiredSec - actualSec) / 3600;
    let billable = missingHours - allowed;

    if (billable <= 0) return basePay;

    let deductionRatePerHour = Math.floor(basePay / 185);
    let salaryDeduction = Math.floor(billable) * deductionRatePerHour;
    return basePay - salaryDeduction;
} 

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
}; 
