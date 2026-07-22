// API-ключ Spoonacular хранится отдельно, чтобы его было легко заменить.
const API_KEY = "3d2b91d1ba834859b1cdb7170b932aac";

// Основные адреса API.
const BASE_URL = "https://api.spoonacular.com/recipes";
const RECIPES_LIMIT = 12;

// Получаем элементы интерфейса.
const searchForm = document.getElementById("searchForm");
const ingredientsInput = document.getElementById("ingredientsInput");
const searchButton = document.getElementById("searchButton");
const recipesGrid = document.getElementById("recipesGrid");
const loader = document.getElementById("loader");
const message = document.getElementById("message");
const resultsCount = document.getElementById("resultsCount");
const recipeModal = document.getElementById("recipeModal");
const modalBody = document.getElementById("modalBody");
const modalClose = document.getElementById("modalClose");
const modalOverlay = document.getElementById("modalOverlay");

// Обработчик отправки формы поиска.
searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const ingredients = ingredientsInput.value.trim();

  if (!ingredients) {
    showMessage("Введите хотя бы один ингредиент. Например: chicken, potato, cheese.", true);
    ingredientsInput.focus();
    return;
  }

  await findRecipes(ingredients);
});

// Закрытие модального окна разными способами.
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !recipeModal.hidden) {
    closeModal();
  }
});

// Запрашивает список рецептов по ингредиентам.
async function findRecipes(ingredients) {
  setLoading(true);
  showMessage("");
  recipesGrid.innerHTML = "";
  resultsCount.textContent = "Идет поиск рецептов...";

  try {
    const params = new URLSearchParams({
      apiKey: API_KEY,
      ingredients,
      number: RECIPES_LIMIT,
      ranking: "1",
      ignorePantry: "true"
    });

    const response = await fetch(`${BASE_URL}/findByIngredients?${params}`);
    await handleApiErrors(response);

    const recipes = await response.json();

    if (!recipes.length) {
      resultsCount.textContent = "Ничего не найдено";
      showMessage("По этим ингредиентам рецепты не найдены. Попробуйте добавить другие продукты.", true);
      return;
    }

    renderRecipes(recipes);
    resultsCount.textContent = `Найдено рецептов: ${recipes.length}`;
  } catch (error) {
    showMessage(error.message, true);
    resultsCount.textContent = "Поиск не выполнен";
  } finally {
    setLoading(false);
  }
}

// Создает карточки найденных рецептов.
function renderRecipes(recipes) {
  recipesGrid.innerHTML = recipes.map((recipe) => {
    const usedIngredients = formatIngredientNames(recipe.usedIngredients);
    const missedIngredients = formatIngredientNames(recipe.missedIngredients);
    const missedCount = recipe.missedIngredientCount || 0;

    return `
      <article class="recipe-card" tabindex="0" data-recipe-id="${recipe.id}">
        <img
          class="recipe-card__image"
          src="${recipe.image}"
          alt="${escapeHtml(recipe.title)}"
          loading="lazy"
        >
        <div class="recipe-card__body">
          <h3>${escapeHtml(recipe.title)}</h3>
          <div class="recipe-card__meta">
            <span class="pill pill--used">Есть: ${recipe.usedIngredientCount || 0}</span>
            <span class="pill pill--missed">Не хватает: ${missedCount}</span>
          </div>
          <div class="ingredients-block">
            <strong>Использованные ингредиенты</strong>
            <p>${usedIngredients || "Нет совпадений"}</p>
          </div>
          <div class="ingredients-block">
            <strong>Недостающие ингредиенты</strong>
            <p>${missedIngredients || "Ничего не нужно докупать"}</p>
          </div>
        </div>
      </article>
    `;
  }).join("");

  // Добавляем открытие подробностей кликом и клавишей Enter.
  document.querySelectorAll(".recipe-card").forEach((card) => {
    card.addEventListener("click", () => getRecipeDetails(card.dataset.recipeId));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        getRecipeDetails(card.dataset.recipeId);
      }
    });
  });
}

// Запрашивает подробную информацию о конкретном рецепте.
async function getRecipeDetails(recipeId) {
  openModal(`
    <div class="details-content">
      <div class="loader" style="display:flex">
        <span></span>
        <p>Загружаем подробный рецепт...</p>
      </div>
    </div>
  `);

  try {
    const params = new URLSearchParams({
      apiKey: API_KEY,
      includeNutrition: "false"
    });

    const response = await fetch(`${BASE_URL}/${recipeId}/information?${params}`);
    await handleApiErrors(response);

    const recipe = await response.json();
    renderRecipeDetails(recipe);
  } catch (error) {
    modalBody.innerHTML = `
      <div class="details-content">
        <h2>Не удалось открыть рецепт</h2>
        <p class="message message--error">${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

// Показывает подробности рецепта в модальном окне.
function renderRecipeDetails(recipe) {
  const ingredients = recipe.extendedIngredients || [];
  const steps = getRecipeSteps(recipe);
  const sourceUrl = recipe.sourceUrl || recipe.spoonacularSourceUrl;

  modalBody.innerHTML = `
    <div class="details-hero">
      <img src="${recipe.image || ""}" alt="${escapeHtml(recipe.title)}">
    </div>
    <div class="details-content">
      <h2 id="modalTitle">${escapeHtml(recipe.title)}</h2>

      <div class="facts">
        <span class="fact">Время: ${recipe.readyInMinutes || "не указано"} мин.</span>
        <span class="fact">Порций: ${recipe.servings || "не указано"}</span>
      </div>

      <div class="details-grid">
        <section class="details-section">
          <h3>Ингредиенты</h3>
          <ul>
            ${ingredients.map((item) => `<li>${escapeHtml(item.original || item.name)}</li>`).join("")}
          </ul>
        </section>

        <section class="details-section">
          <h3>Пошаговая инструкция</h3>
          ${steps.length
            ? `<ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`
            : "<p>Для этого рецепта API не вернул пошаговую инструкцию.</p>"
          }
        </section>
      </div>

      ${sourceUrl
        ? `<a class="original-link" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Открыть оригинальный рецепт</a>`
        : ""
      }
    </div>
  `;
}

// Достает шаги приготовления из разных полей ответа API.
function getRecipeSteps(recipe) {
  if (recipe.analyzedInstructions && recipe.analyzedInstructions.length > 0) {
    return recipe.analyzedInstructions
      .flatMap((instruction) => instruction.steps || [])
      .map((step) => step.step)
      .filter(Boolean);
  }

  if (recipe.instructions) {
    const cleanText = stripHtml(recipe.instructions);
    return cleanText
      .split(/\.\s+/)
      .map((step) => step.trim())
      .filter(Boolean);
  }

  return [];
}

// Обрабатывает ошибки API, включая лимиты Spoonacular.
async function handleApiErrors(response) {
  if (response.ok) {
    return;
  }

  let apiMessage = "";

  try {
    const data = await response.json();
    apiMessage = data.message || data.status || "";
  } catch {
    apiMessage = "";
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("API-ключ недействителен или доступ запрещен. Проверьте ключ Spoonacular.");
  }

  if (response.status === 402 || response.status === 429) {
    throw new Error("Закончился лимит запросов Spoonacular. Попробуйте позже или используйте другой API-ключ.");
  }

  throw new Error(apiMessage || "Spoonacular API не отвечает. Попробуйте повторить запрос позже.");
}

// Показывает или скрывает состояние загрузки.
function setLoading(isLoading) {
  loader.hidden = !isLoading;
  searchButton.disabled = isLoading;
  searchButton.textContent = isLoading ? "Ищем..." : "Найти рецепты";
}

// Выводит сообщение пользователю.
function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("message--error", isError);
}

// Открывает модальное окно.
function openModal(content) {
  modalBody.innerHTML = content;
  recipeModal.hidden = false;
  document.body.style.overflow = "hidden";
  modalClose.focus();
}

// Закрывает модальное окно.
function closeModal() {
  recipeModal.hidden = true;
  document.body.style.overflow = "";
  modalBody.innerHTML = "";
}

// Превращает массив ингредиентов в безопасную строку.
function formatIngredientNames(ingredients = []) {
  return ingredients
    .map((ingredient) => ingredient.name)
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");
}

// Удаляет HTML-теги из инструкций API.
function stripHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.textContent || template.content.innerText || "";
}

// Экранирует текст, который вставляется в HTML.
function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
