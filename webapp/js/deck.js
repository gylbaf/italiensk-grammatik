window.QuizApp = window.QuizApp || {};

(function () {
  "use strict";

  function getData() {
    return window.QUIZ_DATA || { schede: [], esercizi: [] };
  }

  function schedaCards(scheda) {
    return (scheda.exercises || []).map((ex) => ({
      id: `scheda:${scheda.file}:${ex.num}`,
      groupTitle: `Scheda ${scheda.id} – ${scheda.title}`,
      label: `${ex.num} •`,
      instruction: ex.instruction,
      body: ex.body,
      answerBody: ex.answerBody || null,
      blanks: ex.blanks || null,
      matching: ex.matching || null,
      passage: ex.passage || null,
      categorization: ex.categorization || null,
      wordBank: ex.wordBank || null,
    }));
  }

  function esercizioCards(es) {
    return (es.sections || []).map((sec, i) => ({
      id: `es:${es.file}:${i}`,
      groupTitle: es.title,
      label: "",
      instruction: sec.heading,
      body: sec.body,
      answerBody: sec.answerBody || null,
      blanks: sec.blanks || null,
      matching: sec.matching || null,
      passage: sec.passage || null,
      categorization: sec.categorization || null,
      wordBank: sec.wordBank || null,
    }));
  }

  function allSchedaCards() {
    const data = getData();
    return data.schede.flatMap(schedaCards);
  }

  function allEserciziCards() {
    const data = getData();
    return data.esercizi.flatMap(esercizioCards);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  QuizApp.deck = {
    getData,
    schedaCards,
    esercizioCards,
    allSchedaCards,
    allEserciziCards,
    shuffle,
  };
})();
