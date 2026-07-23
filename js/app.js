      let i = {
        singleQuestions: [],
        multiQuestions: [],
        currentQuestions: [],
        userAnswers: {},
        reviewRevealedAnswers: {},
        currentQuestionIndex: 0,
        mode: "exam",
      };
      const REVIEW_PROGRESS_KEY = "aiTrainerTheoryReviewProgressV1";
      const WRONG_BOOK_KEY = "aiTrainerTheoryWrongBookV1";
      const EXAM_HISTORY_KEY = "aiTrainerTheoryExamHistoryV1";
      const QUESTION_DATA_SOURCES = {
        single: "data/single-questions.json",
        multi: "data/multi-questions.json",
      };
      const screens = document.querySelectorAll(".screen");
      const navigationSidebar = document.getElementById("navigationSidebar");
      const navigationScrollBar = document.getElementById(
        "navigationScrollBar",
      );
      const navigationScrollThumb = document.getElementById(
        "navigationScrollThumb",
      );
      let navigationScrollTimer = null;
      let currentExamResult = null;
      document.addEventListener("DOMContentLoaded", function () {
        document.addEventListener("keydown", handleKeyboardShortcut);
        navigationSidebar.addEventListener("scroll", L, { passive: true });
        window.addEventListener("resize", M);
        window.addEventListener("focus", refreshModeSummary);
        window.addEventListener("visibilitychange", refreshModeSummary);
        window.addEventListener("storage", function (a) {
          if (
            a.key === WRONG_BOOK_KEY ||
            a.key === REVIEW_PROGRESS_KEY ||
            a.key === EXAM_HISTORY_KEY
          ) {
            refreshModeSummary();
          }
        });
        p();
      });
      function showScreen(a) {
        screens.forEach((a) => a.classList.remove("screen--active"));
        document.getElementById(`${a}Content`).classList.add("screen--active");
        refreshModeSummary();
      }
      async function loadQuestionData() {
        const [a, b] = await Promise.all([
          fetch(QUESTION_DATA_SOURCES.single),
          fetch(QUESTION_DATA_SOURCES.multi),
        ]);
        if (!a.ok) {
          throw new Error(`单选题库加载失败: ${a.status} ${a.statusText}`);
        }
        if (!b.ok) {
          throw new Error(`多选题库加载失败: ${b.status} ${b.statusText}`);
        }
        return {
          singleData: await a.json(),
          multiData: await b.json(),
        };
      }
      async function p() {
        try {
          const { singleData, multiData } = await loadQuestionData();
          if (
            !singleData.rows ||
            !Array.isArray(singleData.rows)
          ) {
            throw new Error("单选题库缺少有效的 rows 数组或格式不正确");
          }
          if (
            !multiData.rows ||
            !Array.isArray(multiData.rows)
          ) {
            throw new Error("多选题库缺少有效的 rows 数组或格式不正确");
          }
          i.singleQuestions = q(singleData.rows, "single");
          i.multiQuestions = q(multiData.rows, "multi");
          if (i.singleQuestions.length > 0 && i.multiQuestions.length > 0) {
            refreshModeSummary();
            showScreen("mode");
          } else {
            throw new Error("题库中没有有效的题目，请检查 JSON 数据！");
          }
        } catch (a) {
          console.error("加载内嵌题库失败:", a);
          r(a.message);
        }
      }
      function r(a) {
        const b = document.getElementById("modeContent");
        b.innerHTML = `<h2>题库加载失败</h2><div class="error-message" style="color: #dc3545; text-align: center; padding: 20px;"><p>${a}</p><p>请检查 data/single-questions.json 和 data/multi-questions.json 是否可以正常加载。</p></div>`;
      }
      function q(a, b) {
        const c = [];
        for (const d of a) {
          if (
            (b === "single" && d.type !== "0") ||
            (b === "multi" && d.type !== "1")
          ) {
            continue;
          }
          const e = s(d, b);
          if (e) {
            c.push(e);
          }
        }
        return c;
      }
      function s(a, b) {
        try {
          const c = t(a.topic || "");
          const d = u(a.options || []);
          const e = v(a.parsing || "");
          if (!c || !d.length || !e) {
            return null;
          }
          if (b === "multi" && (d.length < 2 || e.length < 2)) {
            return null;
          }
          return {
            type: b,
            topic: c,
            options: d,
            correctAnswer: e,
            id: a.id || "",
          };
        } catch (a) {
          console.error("解析题目时出错:", a);
          return null;
        }
      }
      function t(a) {
        if (!a) return "";
        return a
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();
      }
      function v(a) {
        if (!a) return "";
        const b = t(a).match(/[A-Z]/g) || [];
        return b.sort().join("");
      }
      function u(a) {
        if (!a) return [];
        const b = [];
        for (const c of a) {
          const d = c.optionsnum || "";
          if (d) {
            const e = t(c.options || "");
            b.push([d, e]);
          }
        }
        return b;
      }
      function getQuestionKey(a) {
        if (!a) return "";
        return a.id || `${a.type}:${a.topic}`;
      }
      function getWrongBook() {
        try {
          const a = localStorage.getItem(WRONG_BOOK_KEY);
          if (!a) return {};
          const b = JSON.parse(a);
          if (!b || typeof b !== "object" || Array.isArray(b)) return {};
          return b;
        } catch (a) {
          console.warn("读取错题集失败:", a);
          return {};
        }
      }
      function saveWrongBook(a) {
        try {
          if (Object.keys(a).length) {
            localStorage.setItem(WRONG_BOOK_KEY, JSON.stringify(a));
          } else {
            localStorage.removeItem(WRONG_BOOK_KEY);
          }
        } catch (a) {
          console.warn("保存错题集失败:", a);
        } finally {
          updateWrongModeButton();
        }
      }
      function addWrongQuestion(a) {
        const b = getQuestionKey(a);
        if (!b) return;
        const c = getWrongBook();
        c[b] = {
          id: a.id || b,
          type: a.type,
          correctCount: 0,
          updatedAt: Date.now(),
        };
        saveWrongBook(c);
      }
      function markWrongQuestionCorrect(a) {
        const b = getQuestionKey(a);
        const c = getWrongBook();
        if (!b || !c[b]) return;
        const d = (Number(c[b].correctCount) || 0) + 1;
        if (d >= 2) {
          delete c[b];
        } else {
          c[b] = {
            ...c[b],
            correctCount: d,
            updatedAt: Date.now(),
          };
        }
        saveWrongBook(c);
      }
      function getWrongQuestions() {
        const a = getWrongBook();
        const b = new Map(
          [...i.singleQuestions, ...i.multiQuestions].map((a, b) => [
            getQuestionKey(a),
            { question: a, order: b },
          ]),
        );
        return Object.keys(a)
          .map((a) => b.get(a))
          .filter(Boolean)
          .sort((a, b) => a.order - b.order)
          .map((a) => a.question);
      }
      function refreshModeSummary() {
        updateWrongModeButton();
        updateExamHistoryButton();
        updateModeStats();
        updateModeStatsVisibility();
      }
      function updateWrongModeButton() {
        const a = getWrongQuestions().length;
        const b = document.getElementById("wrongModeBtn");
        const c = document.getElementById("wrongCountText");
        if (c) c.textContent = String(a);
        if (!b) return;
        b.disabled = a === 0;
        b.title = a === 0 ? "暂无错题" : `错题集当前有 ${a} 道题`;
      }
      function getExamHistory() {
        try {
          const a = localStorage.getItem(EXAM_HISTORY_KEY);
          if (!a) return [];
          const b = JSON.parse(a);
          if (!Array.isArray(b)) return [];
          return b;
        } catch (a) {
          console.warn("读取考试记录失败:", a);
          return [];
        }
      }
      function saveExamHistory(a) {
        try {
          if (a.length) {
            localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(a));
          } else {
            localStorage.removeItem(EXAM_HISTORY_KEY);
          }
        } catch (a) {
          console.warn("保存考试记录失败:", a);
        } finally {
          updateExamHistoryButton();
        }
      }
      function saveExamHistoryRecord(a) {
        const b = getExamHistory();
        b.unshift(a);
        saveExamHistory(b);
      }
      function updateExamHistoryButton() {
        const a = getExamHistory().length;
        const b = document.getElementById("examHistoryBtn");
        const c = document.getElementById("examHistoryCountText");
        if (c) c.textContent = String(a);
        if (b) {
          b.disabled = a === 0;
          b.title = a === 0 ? "暂无考试结果" : `已保存 ${a} 次考试结果`;
        }
      }
      function getReviewProgress() {
        try {
          const a = localStorage.getItem(REVIEW_PROGRESS_KEY);
          if (!a) return {};
          const b = JSON.parse(a);
          if (!b || typeof b !== "object" || Array.isArray(b)) return {};
          return b;
        } catch (a) {
          console.warn("读取背题进度失败:", a);
          return {};
        }
      }
      function isAnswerCorrect(a, b) {
        if (!a || !b) return false;
        if (a.type === "single") {
          return b === a.correctAnswer;
        }
        const c = new Set(b);
        const d = new Set(a.correctAnswer);
        return c.size === d.size && [...c].every((a) => d.has(a));
      }
      function getModeStats() {
        const a = [...i.singleQuestions, ...i.multiQuestions];
        const b = getReviewProgress();
        const c = b.userAnswers || {};
        const d = b.reviewRevealedAnswers || {};
        let e = 0;
        let f = 0;
        Object.keys(d).forEach((b) => {
          if (!d[b] || !c[b]) return;
          const g = a[Number(b)];
          if (!g) return;
          e++;
          if (isAnswerCorrect(g, c[b])) {
            f++;
          }
        });
        return {
          done: e,
          remaining: Math.max(a.length - e, 0),
          accuracy: e ? (f / e) * 100 : 0,
        };
      }
      function updateModeStats() {
        const a = getModeStats();
        const b = document.getElementById("doneCountText");
        const c = document.getElementById("remainingCountText");
        const d = document.getElementById("accuracyText");
        if (b) b.textContent = String(a.done);
        if (c) c.textContent = String(a.remaining);
        if (d) d.textContent = `${a.accuracy.toFixed(1)}%`;
        updateModeStatsVisibility();
      }
      function updateModeStatsVisibility() {
        const a = document.getElementById("modeStats");
        const row = document.getElementById("modeStatsRow");
        if (!a) return;
        const c = document
          .getElementById("examContent")
          .classList.contains("screen--active");
        document.body.classList.toggle("is-taking-questions", c);
        const b =
          (i.mode === "exam" || i.mode === "wrong") &&
          (c ||
            document
              .getElementById("resultContent")
              .classList.contains("screen--active"));
        if (b) {
          a.classList.add("is-hidden");
          if (row) row.classList.add("is-hidden");
        } else {
          a.classList.remove("is-hidden");
          if (row) row.classList.remove("is-hidden");
        }
      }
      function showModeMessage(a) {
        const b = document.getElementById("modeActionMessage");
        if (b) b.textContent = a || "";
      }
      function showQuestionMessage(a) {
        const b = document.getElementById("questionMessage");
        if (b) b.textContent = a || "";
      }
      function b(a) {
        showModeMessage("");
        if (a === "exam") {
          const b = 70;
          const c = 10;
          if (i.singleQuestions.length < b) {
            alert(
              `单选题库不足！当前只有 ${i.singleQuestions.length} 道，需要 ${b} 道`,
            );
            return;
          }
          if (i.multiQuestions.length < c) {
            alert(
              `多选题库不足！当前只有 ${i.multiQuestions.length} 道，需要 ${c} 道`,
            );
            return;
          }
          const d = w(i.singleQuestions, b);
          const e = w(i.multiQuestions, c);
          i.currentQuestions = [...d, ...e];
        } else if (a === "wrong") {
          const b = getWrongQuestions();
          if (!b.length) {
            i.currentQuestions = [];
            i.userAnswers = {};
            i.reviewRevealedAnswers = {};
            i.currentQuestionIndex = 0;
            document
              .getElementById("navigationSidebar")
              .classList.remove("active");
            showModeMessage("暂无错题。背题或考试中答错后会自动加入错题集。");
            updateWrongModeButton();
            showScreen("mode");
            M();
            return;
          }
          i.currentQuestions = b;
        } else {
          i.currentQuestions = [...i.singleQuestions, ...i.multiQuestions];
        }
        i.mode = a;
        i.userAnswers = {};
        i.reviewRevealedAnswers = {};
        i.currentQuestionIndex = 0;
        if (a === "review") {
          I();
        }
        if (a === "review" || a === "exam" || a === "wrong") {
          x();
          document.getElementById("navigationSidebar").classList.add("active");
        } else {
          document
            .getElementById("navigationSidebar")
            .classList.remove("active");
        }
        y();
        showScreen("exam");
        scheduleCurrentNavVisibilityCheck();
        M();
      }
      function restartReview() {
        if (i.mode !== "review") return;
        i.userAnswers = {};
        i.reviewRevealedAnswers = {};
        i.currentQuestionIndex = 0;
        try {
          localStorage.removeItem(REVIEW_PROGRESS_KEY);
        } catch (a) {
          console.warn("清空背题进度失败:", a);
        }
        y();
        updateModeStats();
        scheduleCurrentNavVisibilityCheck();
      }
      function w(a, b) {
        const c = [...a].sort(() => 0.5 - Math.random());
        return c.slice(0, b);
      }
      function x() {
        const a = document.getElementById("singleNumbers");
        const b = document.getElementById("multiNumbers");
        a.innerHTML = "";
        b.innerHTML = "";
        let c = 0;
        let d = 0;
        i.currentQuestions.forEach((e, f) => {
          const g = document.createElement("div");
          g.className = "nav-number";
          g.textContent = e.type === "single" ? ++c : ++d;
          g.dataset.globalIndex = f;
          g.addEventListener("click", () => {
            if (i.mode === "review" || i.mode === "wrong") {
              B();
            }
            i.currentQuestionIndex = f;
            J();
            y();
          });
          if (e.type === "single") {
            a.appendChild(g);
          } else {
            b.appendChild(g);
          }
        });
        M();
      }
      function M() {
        if (
          !navigationSidebar ||
          !navigationScrollBar ||
          !navigationScrollThumb ||
          !navigationSidebar.classList.contains("active") ||
          navigationSidebar.scrollHeight <= navigationSidebar.clientHeight
        ) {
          navigationScrollBar.style.display = "none";
          navigationScrollBar.classList.remove("is-scrolling");
          return;
        }
        navigationScrollBar.style.display = "block";
        const a = navigationSidebar.parentElement;
        const b = navigationSidebar.offsetTop + 4;
        const c = navigationSidebar.clientHeight - 8;
        const d =
          a.clientWidth -
          navigationSidebar.offsetLeft -
          navigationSidebar.offsetWidth +
          6;
        const e = Math.max(
          24,
          (navigationSidebar.clientHeight / navigationSidebar.scrollHeight) * c,
        );
        const f =
          navigationSidebar.scrollTop /
          (navigationSidebar.scrollHeight - navigationSidebar.clientHeight);
        navigationScrollBar.style.top = `${b}px`;
        navigationScrollBar.style.right = `${d}px`;
        navigationScrollBar.style.height = `${c}px`;
        navigationScrollThumb.style.height = `${e}px`;
        navigationScrollThumb.style.transform = `translateY(${(c - e) * f}px)`;
      }
      function L() {
        M();
        navigationScrollBar.classList.add("is-scrolling");
        clearTimeout(navigationScrollTimer);
        navigationScrollTimer = setTimeout(() => {
          navigationScrollBar.classList.remove("is-scrolling");
        }, 650);
      }
      function z() {
        if (i.mode !== "exam" && i.mode !== "review" && i.mode !== "wrong")
          return;
        document.querySelectorAll(".nav-number").forEach((a) => {
          a.classList.remove("correct", "wrong", "current");
        });
        i.currentQuestions.forEach((a, b) => {
          const c = i.userAnswers[b] || "";
          const d = a.correctAnswer;
          let e = false;
          if (a.type === "single") {
            e = c === d;
          } else {
            const f = new Set(c);
            const g = new Set(d);
            e = f.size === g.size && [...f].every((a) => g.has(a));
          }
          const h = document.querySelector(
            `.nav-number[data-global-index="${b}"]`,
          );
          if (h) {
            const j = i.reviewRevealedAnswers[b];
            if (j && e) {
              h.classList.add("correct");
            } else if (j && c) {
              h.classList.add("wrong");
            }
          }
        });
        const a = document.querySelector(
          `.nav-number[data-global-index="${i.currentQuestionIndex}"]`,
        );
        if (a) {
          a.classList.add("current");
          scheduleCurrentNavVisibilityCheck();
        }
      }
      function scheduleCurrentNavVisibilityCheck() {
        const a =
          window.requestAnimationFrame ||
          function (a) {
            return setTimeout(a, 0);
          };
        a(keepCurrentNavInView);
      }
      function keepCurrentNavInView() {
        if (
          !navigationSidebar ||
          !navigationSidebar.classList.contains("active") ||
          navigationSidebar.scrollHeight <= navigationSidebar.clientHeight
        ) {
          return;
        }
        const a = document.querySelector(
          `.nav-number[data-global-index="${i.currentQuestionIndex}"]`,
        );
        if (!a) return;
        const b = 8;
        const c = navigationSidebar.getBoundingClientRect();
        const d = a.getBoundingClientRect();
        if (!c.height || !d.height) return;
        if (d.top < c.top + b) {
          navigationSidebar.scrollTop -= c.top + b - d.top;
        } else if (d.bottom > c.bottom - b) {
          navigationSidebar.scrollTop += d.bottom - (c.bottom - b);
        }
        M();
      }
      function handleKeyboardShortcut(a) {
        if (!shouldHandleKeyboardShortcut(a)) return;
        const b = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" }[a.key];
        if (b) {
          const c = document.querySelector(
            `#optionsContainer .option-item[data-letter="${b}"]`,
          );
          if (c) {
            a.preventDefault();
            c.click();
          }
          return;
        }
        if (a.key === "Enter") {
          a.preventDefault();
          if (
            i.currentQuestionIndex === i.currentQuestions.length - 1 &&
            i.reviewRevealedAnswers[i.currentQuestionIndex]
          ) {
            return;
          }
          d();
        }
      }
      function shouldHandleKeyboardShortcut(a) {
        if (!i.currentQuestions.length) return false;
        if (!document.getElementById("examContent").classList.contains("screen--active"))
          return false;
        if (a.metaKey || a.ctrlKey || a.altKey) return false;
        const b = a.target || document.activeElement;
        if (!b) return true;
        const c = (b.tagName || "").toUpperCase();
        return (
          c !== "INPUT" &&
          c !== "TEXTAREA" &&
          c !== "SELECT" &&
          !b.isContentEditable
        );
      }
      function y() {
        if (i.currentQuestionIndex >= i.currentQuestions.length) return;
        const a = i.currentQuestions[i.currentQuestionIndex];
        const c = i.currentQuestions.length;
        document.getElementById("questionText").textContent =
          `第 ${i.currentQuestionIndex + 1} 题 \n\n${a.topic}`;
        const d = document.getElementById("optionsContainer");
        const h = i.userAnswers[i.currentQuestionIndex] || "";
        const j =
          i.mode === "exam" || i.mode === "review" || i.mode === "wrong";
        d.innerHTML = "";
        showQuestionMessage("");
        a.options.forEach(([e, f]) => {
          const g = document.createElement("div");
          g.className = "option-item";
          g.textContent = `${e}. ${f}`;
          g.dataset.letter = e;
          if (h.includes(e)) {
            g.classList.add("selected");
          }
          if (a.type === "single") {
            g.addEventListener("click", function () {
              if (j && i.reviewRevealedAnswers[i.currentQuestionIndex]) {
                return;
              }
              d.querySelectorAll(".option-item").forEach((a) => {
                a.classList.remove("selected");
              });
              this.classList.add("selected");
              showQuestionMessage("");
              if (j) {
                B();
                J();
              }
            });
          } else {
            g.addEventListener("click", function () {
              if (j && i.reviewRevealedAnswers[i.currentQuestionIndex]) {
                return;
              }
              this.classList.toggle("selected");
              showQuestionMessage("");
              if (j) {
                B();
                J();
              }
            });
          }
          d.appendChild(g);
        });
        if (i.reviewRevealedAnswers[i.currentQuestionIndex]) {
          G();
        }
        A();
        document.getElementById("prevBtn").disabled =
          i.currentQuestionIndex === 0;
        updateNextButtonText();
        updateReviewRestartButton();
        z();
      }
      function updateNextButtonText() {
        const a = document.getElementById("nextBtn");
        if (!a) return;
        const b = i.currentQuestionIndex === i.currentQuestions.length - 1;
        const c = i.reviewRevealedAnswers[i.currentQuestionIndex];
        a.textContent = "下一题";
        a.style.display = b && c ? "none" : "inline-block";
      }
      function updateReviewRestartButton() {
        const a = document.getElementById("restartReviewBtn");
        if (!a) return;
        a.style.display = i.mode === "review" ? "inline-block" : "none";
      }
      function A() {
        const a = i.currentQuestions.length;
        const b = K();
        const c = ((i.currentQuestionIndex + 1) / a) * 100;
        document.getElementById("progressText").textContent =
          `进度: ${i.currentQuestionIndex + 1}/${a} | 已答题: ${b}/${a}`;
        document.getElementById("progressFill").style.width = `${c}%`;
      }
      function B() {
        if (i.currentQuestionIndex >= i.currentQuestions.length) return;
        const a = i.currentQuestions[i.currentQuestionIndex];
        let b = "";
        if (a.type === "single") {
          const c = document.querySelector(
            "#optionsContainer .option-item.selected",
          );
          b = c ? c.dataset.letter : "";
        } else {
          const c = document.querySelectorAll(
            "#optionsContainer .option-item.selected",
          );
          const d = Array.from(c).map((a) => a.dataset.letter);
          b = d.sort().join("");
        }
        if (b) {
          i.userAnswers[i.currentQuestionIndex] = b;
        } else {
          delete i.userAnswers[i.currentQuestionIndex];
        }
      }
      function K() {
        if (i.mode === "exam" || i.mode === "review" || i.mode === "wrong") {
          return Object.keys(i.reviewRevealedAnswers).filter(
            (a) => i.reviewRevealedAnswers[a] && i.userAnswers[a],
          ).length;
        }
        return Object.values(i.userAnswers).filter(Boolean).length;
      }
      function hasInvalidMultiSelection(a, b) {
        return a && a.type === "multi" && b && b.length === 1;
      }
      function I() {
        try {
          const a = localStorage.getItem(REVIEW_PROGRESS_KEY);
          if (!a) return;
          const b = JSON.parse(a);
          if (!b || b.total !== i.currentQuestions.length) return;
          i.userAnswers = b.userAnswers || {};
          i.reviewRevealedAnswers = b.reviewRevealedAnswers || {};
          i.currentQuestionIndex = Math.min(
            Math.max(Number(b.currentQuestionIndex) || 0, 0),
            i.currentQuestions.length - 1,
          );
        } catch (a) {
          console.warn("恢复背题进度失败:", a);
        }
      }
      function J() {
        if (i.mode !== "review") return;
        try {
          localStorage.setItem(
            REVIEW_PROGRESS_KEY,
            JSON.stringify({
              total: i.currentQuestions.length,
              currentQuestionIndex: i.currentQuestionIndex,
              userAnswers: i.userAnswers,
              reviewRevealedAnswers: i.reviewRevealedAnswers,
              savedAt: Date.now(),
            }),
          );
        } catch (a) {
          console.warn("保存背题进度失败:", a);
        } finally {
          updateModeStats();
        }
      }
      function C() {
        if (i.currentQuestionIndex >= i.currentQuestions.length) return true;
        const a = i.currentQuestions[i.currentQuestionIndex];
        const b = i.userAnswers[i.currentQuestionIndex] || "";
        const c = a.correctAnswer;
        if (a.type === "single") {
          return b === c;
        } else {
          const d = new Set(b);
          const e = new Set(c);
          return d.size === e.size && [...d].every((a) => e.has(a));
        }
      }
      function G() {
        const a = i.currentQuestions[i.currentQuestionIndex];
        if (!a) return;
        const b = new Set(
          (i.userAnswers[i.currentQuestionIndex] || "").split(""),
        );
        const c = new Set(a.correctAnswer.split(""));
        document
          .querySelectorAll("#optionsContainer .option-item")
          .forEach((a) => {
            const d = a.dataset.letter;
            a.classList.remove("correct", "wrong");
            if (c.has(d)) {
              a.classList.add("correct");
            }
            if (b.has(d) && !c.has(d)) {
              a.classList.add("wrong");
            }
          });
      }
      function H() {
        const a = i.currentQuestionIndex;
        if (i.reviewRevealedAnswers[a]) {
          if (a < i.currentQuestions.length - 1) {
            E();
          }
          return;
        }
        const b = i.currentQuestions[a];
        B();
        if (hasInvalidMultiSelection(b, i.userAnswers[a] || "")) {
          showQuestionMessage("多选题至少选择 2 个选项");
          J();
          A();
          return;
        }
        const c = Boolean(i.userAnswers[a]);
        i.reviewRevealedAnswers[a] = true;
        const d = C();
        if (c && d && i.mode === "wrong") {
          markWrongQuestionCorrect(b);
        } else if (c && !d) {
          addWrongQuestion(b);
        }
        G();
        z();
        J();
        A();
        updateNextButtonText();
        if (d && a < i.currentQuestions.length - 1) {
          E();
        }
      }
      function d() {
        if (i.mode === "exam" || i.mode === "review" || i.mode === "wrong") {
          H();
          return;
        }
      }
      function E() {
        i.currentQuestionIndex++;
        if (i.currentQuestionIndex >= i.currentQuestions.length) {
          J();
          if (i.mode === "wrong") {
            const a = getWrongQuestions();
            if (!a.length) {
              i.currentQuestions = [];
              i.userAnswers = {};
              i.reviewRevealedAnswers = {};
              i.currentQuestionIndex = 0;
              document
                .getElementById("navigationSidebar")
                .classList.remove("active");
              showModeMessage(
                "错题集已清空。背题或考试中答错后会自动加入错题集。",
              );
              showScreen("mode");
              M();
            } else {
              i.currentQuestions = a;
              i.userAnswers = {};
              i.reviewRevealedAnswers = {};
              i.currentQuestionIndex = 0;
              x();
              y();
              M();
            }
            return;
          }
          e();
        } else {
          J();
          y();
        }
      }
      function c() {
        B();
        i.currentQuestionIndex--;
        J();
        y();
      }
      function e() {
        const a =
          "确定要提交考试吗？未回答的题目将计0分。\n\n温馨提示：实际考试理论试卷由70道单选题+10道多选题+20道判断题组成，本模拟系统不包含判断题（机构也没有提供题库）";
        if (!confirm(a)) return;
        try {
          const { score: b, total: c, results: d } = F();
          d.forEach((a) => {
            if (!a.isCorrect) {
              addWrongQuestion(a.questionData);
            }
          });
          const e = createExamHistoryRecord(b, c, d);
          saveExamHistoryRecord(e);
          renderExamResult(e);
          showScreen("result");
        } catch (a) {
          console.error("提交考试错误:", a);
          alert(`提交考试时发生错误: ${a.message}`);
        }
      }
      function createExamHistoryRecord(a, b, c) {
        const d = b ? (a / b) * 100 : 0;
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          submittedAt: Date.now(),
          score: a,
          total: b,
          accuracy: d,
          results: c.map((a) => ({
            questionNum: a.questionNum,
            type: a.type,
            userAnswer: a.userAnswer,
            correctAnswer: a.correctAnswer,
            isCorrect: a.isCorrect,
            score: a.score,
            questionData: {
              id: a.questionData.id || "",
              type: a.questionData.type,
              topic: a.questionData.topic,
              options: a.questionData.options,
              correctAnswer: a.questionData.correctAnswer,
            },
          })),
        };
      }
      function formatExamTime(a) {
        const b = new Date(a);
        if (Number.isNaN(b.getTime())) return "未知时间";
        const c = (a) => String(a).padStart(2, "0");
        return `${b.getFullYear()}-${c(b.getMonth() + 1)}-${c(b.getDate())} ${c(b.getHours())}:${c(b.getMinutes())}`;
      }
      function escapeHtml(a) {
        return String(a ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }
      function renderExamResult(a) {
        currentExamResult = a;
        const b = document.getElementById("resultTitle");
        const c = document.getElementById("scoreDisplay");
        const d = document.getElementById("resultDetails");
        const e = document.getElementById("resultListBtn");
        const filter = document.getElementById("resultFilter");
        const onlyWrong = document.getElementById("onlyWrongFilter");
        if (b) b.textContent = `考试结果 ${formatExamTime(a.submittedAt)}`;
        if (c) {
          c.style.display = "block";
          c.textContent = `您的得分: ${a.accuracy.toFixed(1)}分（${a.score}/${a.total}）`;
        }
        if (e) e.style.display = getExamHistory().length ? "inline-block" : "none";
        if (filter) filter.style.display = "flex";
        const results = onlyWrong && onlyWrong.checked
          ? a.results.filter((a) => !a.isCorrect)
          : a.results;
        let f = "";
        results.forEach((a) => {
          const b = a.type === "single" ? "单选题" : "多选题";
          const c = a.isCorrect ? "status-correct" : "status-wrong";
          const d = a.isCorrect ? "✓ 正确" : "✗ 错误";
          const e = a.userAnswer || "未作答";
          const correctLetters = new Set(String(a.correctAnswer || "").split(""));
          let g = "";
          a.questionData.options.forEach(([a, b]) => {
            const c = correctLetters.has(a) ? " correct-option" : "";
            g += `<div class="option-line${c}">${escapeHtml(a)}. ${escapeHtml(b)}</div>`;
          });
          const h = a.isCorrect
            ? ""
            : `<div class="answer-line"><span class="your-answer">您的答案: ${escapeHtml(e)}</span></div>`;
          f += `<div class="question-result-item"><div class="question-header">第 ${a.questionNum} 题（${b}）— <span class="${c}">${d}</span></div><div class="question-topic">${escapeHtml(a.questionData.topic)}</div><div class="question-options">${g}</div>${h}</div>`;
        });
        d.innerHTML = f || `<div class="mode-message">没有错误题。</div>`;
      }
      function renderCurrentExamResult() {
        if (currentExamResult) renderExamResult(currentExamResult);
      }
      function showExamHistoryList() {
        currentExamResult = null;
        const a = getExamHistory();
        const b = document.getElementById("resultTitle");
        const c = document.getElementById("scoreDisplay");
        const d = document.getElementById("resultDetails");
        const e = document.getElementById("resultListBtn");
        const filter = document.getElementById("resultFilter");
        if (b) b.textContent = "考试结果列表";
        if (c) c.style.display = "none";
        if (e) e.style.display = "none";
        if (filter) filter.style.display = "none";
        if (!a.length) {
          d.innerHTML = `<div class="mode-message">暂无考试结果。提交模拟考试后会自动保存到这里。</div>`;
        } else {
          const f = a.length;
          d.innerHTML = `<div class="exam-history-list">${a
            .map(
              (a, b) =>
                `<button class="exam-history-item" onclick="showExamHistoryRecord('${escapeHtml(a.id)}')"><div class="exam-history-title"><span>第 ${f - b} 次考试</span><span>${a.accuracy.toFixed(1)}分</span></div><div class="exam-history-meta">${formatExamTime(a.submittedAt)} · 得分 ${a.score}/${a.total}</div></button>`,
            )
            .join("")}</div>`;
        }
        showScreen("result");
      }
      function showExamHistoryRecord(a) {
        const b = getExamHistory().find((b) => b.id === a);
        if (!b) {
          showExamHistoryList();
          return;
        }
        renderExamResult(b);
        showScreen("result");
      }
      function F() {
        let a = 0;
        const b = i.currentQuestions.length;
        const c = [];
        for (let d = 0; d < i.currentQuestions.length; d++) {
          const e = i.currentQuestions[d];
          const f = i.userAnswers[d] || "";
          const g = e.correctAnswer;
          let h = false;
          if (e.type === "single") {
            h = f === g;
          } else {
            const a = new Set(f);
            const b = new Set(g);
            h = a.size === b.size && [...a].every((a) => b.has(a));
          }
          const j = h ? 1 : 0;
          a += j;
          c.push({
            questionNum: d + 1,
            type: e.type,
            userAnswer: f,
            correctAnswer: g,
            isCorrect: h,
            score: j,
            questionData: e,
          });
        }
        return { score: a, total: b, results: c };
      }
      function f() {
        showScreen("mode");
      }
