(() => {
        const targetDate =
            new Date("2026-07-25T11:00:00+09:00").getTime();

        const updateCountdown = () => {
            const dDay = document.getElementById("d-day");
            const dHour = document.getElementById("d-hour");
            const dMin = document.getElementById("d-min");
            const dSec = document.getElementById("d-sec");

            if (!dDay || !dHour || !dMin || !dSec) {
                return;
            }

            const distance = Math.max(0, targetDate - Date.now());

            const days = Math.floor(distance / 86400000);
            const hours = Math.floor((distance % 86400000) / 3600000);
            const minutes = Math.floor((distance % 3600000) / 60000);
            const seconds = Math.floor((distance % 60000) / 1000);

            dDay.textContent = String(days).padStart(2, "0");
            dHour.textContent = String(hours).padStart(2, "0");
            dMin.textContent = String(minutes).padStart(2, "0");
            dSec.textContent = String(seconds).padStart(2, "0");
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                updateCountdown();
                window.setInterval(updateCountdown, 1000);
            }, { once: true });
        } else {
            updateCountdown();
            window.setInterval(updateCountdown, 1000);
        }
    })();

document.addEventListener("DOMContentLoaded", async () => {
        const eventMovie = document.getElementById("event-movie");

        if (eventMovie) {
            let hasUserInteracted = false;

            const markUserInteraction = () => {
                hasUserInteracted = true;

                document.removeEventListener("pointerdown", markUserInteraction);
                document.removeEventListener("keydown", markUserInteraction);
            };

            document.addEventListener("pointerdown", markUserInteraction, {
                once: true,
            });

            document.addEventListener("keydown", markUserInteraction, {
                once: true,
            });

            const eventMovieObserver = new IntersectionObserver(
                async ([entry]) => {
                    if (!entry.isIntersecting) {
                        eventMovie.pause();
                        return;
                    }

                    // 상호작용 전에는 음소거 자동재생
                    // 상호작용 후에는 소리 켜고 재생 시도
                    eventMovie.muted = !hasUserInteracted;

                    try {
                        await eventMovie.play();
                    } catch (error) {
                        // 소리 재생이 거부되면 음소거 상태로 다시 재생
                        eventMovie.muted = true;

                        try {
                            await eventMovie.play();
                        } catch (mutedError) {
                            console.log("영상 자동재생이 차단되었습니다.", mutedError);
                        }
                    }
                },
                {
                    threshold: 0.5,
                },
            );

            eventMovieObserver.observe(eventMovie);
        }
        const { API_ORIGIN, CONFERENCE_ID } = window.APP_CONFIG;

        const TICKET_ID = Number(window.APP_CONFIG?.TICKET_ID ?? 1);

        const API_BASE = `${API_ORIGIN}/api/public`;
        const WS_ORIGIN = API_ORIGIN
            .replace(/^https:/, "wss:")
            .replace(/^http:/, "ws:");

        const SPEAKER_API_URL =
            `${API_BASE}/speakers?conference_id=${encodeURIComponent(CONFERENCE_ID)}`;

        const TICKET_PREPARE_API_URL =
            `${API_BASE}/ticket-payments/prepare`;

        const PAYMENT_HISTORY_API_URL =
            `${API_BASE}/ticket-payments/history`;

        const PAYMENT_STATUS_STORAGE_KEY =
            "daks_pending_payment";

        const PAYMENT_SOCKET_RECONNECT_DELAY_MS = 3000;
        const PAYMENT_SOCKET_MAX_RECONNECT_ATTEMPTS = 10;
        const PAYMENT_SOCKET_MAX_WAIT_MS = 120000;

        const APPLICATION_API_BASE =
            API_BASE;

        let lockedScrollY = 0;

        function lockPageScroll() {
            document.body.classList.add("modal-open");
        }

        function unlockPageScroll() {
            if (!document.querySelector(".is-open")) {
                document.body.classList.remove("modal-open");
            }
        }

        const speakerWrapper = document.getElementById("speaker-wrapper");
        const detailWrapper = document.getElementById("speaker-detail-wrapper");
        const modal = document.getElementById("speaker-modal");
        const modalBackdrop = modal?.querySelector(".speaker-modal-backdrop");

        let speakers = [];
        let mainSwiper = null;
        let detailSwiper = null;
        let lastFocusedElement = null;

        const escapeHtml = (value) =>
            String(value ?? "")
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
                .replaceAll('"', "&quot;")
                .replaceAll("'", "&#039;");


        const legalModal = document.getElementById("legal-modal");
        const legalModalDialog = legalModal?.querySelector(".legal-modal-dialog");
        const legalModalContent = legalModal?.querySelector(".legal-modal-content");
        const legalTabButtons = Array.from(
            legalModal?.querySelectorAll("[data-legal-tab-button]") || [],
        );
        const legalPanels = Array.from(
            legalModal?.querySelectorAll("[data-legal-panel]") || [],
        );
        let legalModalLastFocusedElement = null;

        function activateLegalTab(tabName, { focusTab = false } = {}) {
            const safeTabName = ["terms", "privacy", "refund"].includes(tabName)
                ? tabName
                : "terms";

            legalTabButtons.forEach((button) => {
                const isActive = button.dataset.legalTabButton === safeTabName;
                button.classList.toggle("is-active", isActive);
                button.setAttribute("aria-selected", String(isActive));
                button.tabIndex = isActive ? 0 : -1;

                if (isActive && focusTab) {
                    button.focus({ preventScroll: true });
                }
            });

            legalPanels.forEach((panel) => {
                const isActive = panel.dataset.legalPanel === safeTabName;
                panel.classList.toggle("is-active", isActive);
                panel.hidden = !isActive;
            });

            if (legalModalContent) {
                legalModalContent.scrollTop = 0;
            }
        }

        function openLegalModal(tabName = "terms") {
            if (!legalModal) return;

            legalModalLastFocusedElement = document.activeElement;
            activateLegalTab(tabName);
            lockPageScroll();
            legalModal.classList.add("is-open");
            legalModal.setAttribute("aria-hidden", "false");

            window.requestAnimationFrame(() => {
                const activeTab = legalModal.querySelector(
                    `[data-legal-tab-button="${tabName}"]`,
                ) || legalTabButtons[0];
                activeTab?.focus({ preventScroll: true });
            });
        }

        function closeLegalModal() {
            if (!legalModal) return;

            legalModal.classList.remove("is-open");
            legalModal.setAttribute("aria-hidden", "true");
            unlockPageScroll();

            if (legalModalLastFocusedElement instanceof HTMLElement) {
                legalModalLastFocusedElement.focus({ preventScroll: true });
            }
        }

        document.querySelectorAll(".js-open-legal-modal").forEach((trigger) => {
            trigger.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                openLegalModal(trigger.dataset.legalTab || "terms");
            });
        });

        legalTabButtons.forEach((button, index) => {
            button.addEventListener("click", () => {
                activateLegalTab(button.dataset.legalTabButton);
            });

            button.addEventListener("keydown", (event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                    return;
                }

                event.preventDefault();
                let nextIndex = index;

                if (event.key === "ArrowLeft") {
                    nextIndex = (index - 1 + legalTabButtons.length) % legalTabButtons.length;
                } else if (event.key === "ArrowRight") {
                    nextIndex = (index + 1) % legalTabButtons.length;
                } else if (event.key === "Home") {
                    nextIndex = 0;
                } else if (event.key === "End") {
                    nextIndex = legalTabButtons.length - 1;
                }

                const nextButton = legalTabButtons[nextIndex];
                activateLegalTab(nextButton.dataset.legalTabButton, { focusTab: true });
            });
        });

        legalModal?.addEventListener("click", (event) => {
            if (
                event.target.closest("[data-legal-modal-close]") ||
                event.target.classList.contains("legal-modal-backdrop")
            ) {
                closeLegalModal();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && legalModal?.classList.contains("is-open")) {
                event.stopImmediatePropagation();
                closeLegalModal();
            }
        }, true);

        function createMainSlide(speaker) {
            const slide = document.createElement("div");
            slide.className = "swiper-slide speaker-slide";
            slide.dataset.speakerId = String(speaker.id);

            const imageUrl =
                speaker.profile_image_url || "./assets/speaker-photo.png";

            slide.innerHTML = `
          <article
            class="speaker-card"
            tabindex="0"
            aria-label="${escapeHtml(speaker.name)} 상세 보기"
          >
            <div class="speaker-photo-wrap">
              <img
                class="speaker-photo"
                src="${escapeHtml(imageUrl)}"
                alt="${escapeHtml(speaker.name)}"
                loading="lazy"
              />
            </div>

            <div class="speaker-card-content">
              <div class="speaker-summary">
                <h3>${escapeHtml(speaker.name)}</h3>
                ${
                speaker.english_name
                    ? `<p>${escapeHtml(speaker.english_name)}</p>`
                    : ""
            }
              </div>

              ${
                speaker.public_title
                    ? `
              <p class="speaker-main-title">
                ${escapeHtml(speaker.public_title)}
              </p>
            `
                    : ""
            }
            </div>
          </article>
        `;

            return slide;
        }

        function createDetailSlide(speaker) {
            const slide = document.createElement("div");
            slide.className = "swiper-slide speaker-detail-slide";
            slide.dataset.speakerId = String(speaker.id);

            const imageUrl =
                speaker.profile_image_url || "./assets/speaker-photo.png";

            const socialLinks = [
                {
                    url: speaker.x_url,
                    label: "X",
                    icon: "./assets/x-white.svg",
                },
                {
                    url: speaker.youtube_url,
                    label: "YouTube",
                    icon: "./assets/you-white.svg",
                },
                {
                    url: speaker.facebook_url,
                    label: "Facebook",
                    icon: "./assets/facebook-white.svg",
                },
            ].filter((item) => Boolean(item.url));

            const socialHtml = socialLinks
                .map(
                    ({ url, label, icon }) => `
              <a
                href="${escapeHtml(url)}"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="${escapeHtml(speaker.name)} ${label}"
                title="${label}"
              >
                <img
                  src="${escapeHtml(icon)}"
                  alt=""
                  aria-hidden="true"
                />
              </a>
            `,
                )
                .join("");

            const englishNameHtml = speaker.english_name
                ? `<span>${escapeHtml(speaker.english_name)}</span>`
                : "";

            const publicTitleHtml = speaker.public_title
                ? `
              <p class="speaker-detail-title">
                ${escapeHtml(speaker.public_title)}
              </p>
            `
                : "";

            slide.innerHTML = `
          <article class="speaker-detail-card">
            <button
              type="button"
              class="speaker-detail-close"
              aria-label="연사 상세 닫기"
            >
              ×
            </button>
            <div class="speaker-detail-brand michroma-regular">
              <span>2026</span>
              <strong>DIGITAL ASSET<br />KOREA SUMMIT</strong>
            </div>

            <div class="speaker-detail-photo-wrap">
              <img
                class="speaker-detail-photo"
                src="${escapeHtml(imageUrl)}"
                alt="${escapeHtml(speaker.name)}"
              />
            </div>

            <div class="speaker-detail-content">
              <div class="speaker-detail-name-row">
                <h3>${escapeHtml(speaker.name)}</h3>
                ${englishNameHtml}
              </div>

              ${publicTitleHtml}

              <div
                class="speaker-detail-socials"
                ${socialLinks.length === 0 ? "hidden" : ""}
              >
                ${socialHtml}
              </div>
            </div>
          </article>
        `;

            return slide;
        }

        function getCurrentDetailSlide() {
            if (!detailSwiper) return null;
            return detailSwiper.slides[detailSwiper.activeIndex] ?? null;
        }

        function openSpeakerModal(speakerId, triggerElement = null) {
            if (!modal || !detailSwiper) return;

            const index = speakers.findIndex(
                (speaker) => String(speaker.id) === String(speakerId),
            );

            if (index < 0) return;

            lastFocusedElement = triggerElement || document.activeElement;

            lockPageScroll();

            modal.classList.add("is-open");
            modal.setAttribute("aria-hidden", "false");
            mainSwiper?.autoplay?.stop();

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    detailSwiper.update();

                    if (detailSwiper.params.loop) {
                        detailSwiper.slideToLoop(index, 0, false);
                    } else {
                        detailSwiper.slideTo(index, 0, false);
                    }

                    const currentCardCloseButton =
                        getCurrentDetailSlide()?.querySelector(".speaker-detail-close");

                    currentCardCloseButton?.focus({ preventScroll: true });
                });
            });
        }

    function closeSpeakerModal() {
        if (!modal?.classList.contains("is-open")) return;

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");

        mainSwiper?.autoplay?.start();

        unlockPageScroll();

        if (lastFocusedElement instanceof HTMLElement) {
            lastFocusedElement.focus({ preventScroll: true });
        }
    }

    function bindMainCardEvents() {
        document.querySelectorAll(".speaker-card").forEach((card) => {
            const slide = card.closest(".speaker-slide");
            const speakerId = slide?.dataset.speakerId;

            if (!speakerId) return;

            // 마우스 클릭 및 모바일 터치
            card.addEventListener("click", () => {
                if (mainSwiper?.allowClick === false) return;

                openSpeakerModal(speakerId, card);
            });

            // 키보드 접근성 유지
            card.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openSpeakerModal(speakerId, card);
                }
            });
        });
    }

        async function initializeSpeakers() {
            if (!speakerWrapper || !detailWrapper) return;

            try {
                const response = await fetch(SPEAKER_API_URL, {
                    headers: { Accept: "application/json" },
                });

                if (!response.ok) {
                    throw new Error(`연사 목록 조회 실패: ${response.status}`);
                }

                const data = await response.json();

                speakers = data
                    .sort(
                        (a, b) =>
                            (a.display_order ?? Number.MAX_SAFE_INTEGER) -
                            (b.display_order ?? Number.MAX_SAFE_INTEGER),
                    );

                if (speakers.length === 0) {
                    speakerWrapper.innerHTML = `
              <div class="speaker-empty">연사 정보가 곧 공개됩니다.</div>
            `;
                    return;
                }

                const mainFragment = document.createDocumentFragment();
                const detailFragment = document.createDocumentFragment();

                speakers.forEach((speaker) => {
                    mainFragment.appendChild(createMainSlide(speaker));
                    detailFragment.appendChild(createDetailSlide(speaker));
                });

                speakerWrapper.replaceChildren(mainFragment);
                detailWrapper.replaceChildren(detailFragment);

                mainSwiper = new Swiper(".speakerSwiper", {
                    slidesPerView: 1.5,
                    spaceBetween: 10,
                    speed: 550,
                    loop: speakers.length >= 3,
                    centeredSlides: false,
                    slidesOffsetBefore: 0,
                    slidesOffsetAfter: 24,
                    grabCursor: true,
                    watchSlidesProgress: true,
                    breakpoints: {
                        768: {
                            spaceBetween: 18,
                            slidesOffsetAfter: 32,
                        },
                        1024: {
                            spaceBetween: 24,
                            slidesOffsetAfter: 40,
                        },
                    },
                    autoplay:
                        speakers.length >= 2
                            ? {
                                delay: 3500,
                                disableOnInteraction: false,
                                pauseOnMouseEnter: true,
                            }
                            : false,
                });

                detailSwiper = new Swiper(".speakerDetailSwiper", {
                    slidesPerView: 1,
                    centeredSlides: true,
                    spaceBetween: 110,
                    speed: 450,
                    loop: speakers.length >= 3,
                    rewind: false,
                    allowTouchMove: true,
                    observer: true,
                    observeParents: true,
                    navigation: {
                        prevEl: ".speaker-modal-prev",
                        nextEl: ".speaker-modal-next",
                    },
                });

                bindMainCardEvents();
            } catch (error) {
                console.error(error);
                speakerWrapper.innerHTML = `
            <div class="speaker-empty">
              연사 정보를 불러오지 못했습니다.
            </div>
          `;
            }
        }

        modal?.addEventListener("click", (event) => {
            const closeButton = event.target.closest(".speaker-detail-close");

            if (closeButton) {
                event.preventDefault();
                event.stopPropagation();
                closeSpeakerModal();
                return;
            }

            // 실제 상세 카드와 좌우 화살표만 클릭 유지 영역으로 둡니다.
            // 카드와 화살표 사이를 포함한 나머지 빈 공간은 클릭 시 닫습니다.
            if (
                event.target.closest(".speaker-detail-card") ||
                event.target.closest(".speaker-modal-nav")
            ) {
                return;
            }

            event.preventDefault();
            closeSpeakerModal();
        });



        const ticketPurchaseModal =
            document.getElementById("ticket-purchase-modal");
        const ticketPurchaseForm =
            document.getElementById("ticket-purchase-form");
        const ticketPurchaseError =
            document.getElementById("ticket-purchase-error");
        const ticketPurchaseSubmit =
            document.getElementById("ticket-purchase-submit");

        const ticketPhoneInput =
            ticketPurchaseForm?.querySelector('input[name="phone"]');

        function showTicketPurchaseError(message, fieldName = null) {
            if (!ticketPurchaseError) return;

            ticketPurchaseError.textContent =
                message || "결제 준비 중 오류가 발생했습니다.";
            ticketPurchaseError.hidden = false;

            if (fieldName) {
                ticketPurchaseForm
                    ?.querySelector(`[name="${fieldName}"]`)
                    ?.focus({ preventScroll: true });
            }
        }

        function hideTicketPurchaseError() {
            if (!ticketPurchaseError) return;

            ticketPurchaseError.textContent = "";
            ticketPurchaseError.hidden = true;
        }

        ticketPurchaseForm?.addEventListener("input", hideTicketPurchaseError);
        ticketPurchaseForm?.addEventListener("change", hideTicketPurchaseError);

        ticketPhoneInput?.addEventListener("input", (event) => {
            const input = event.currentTarget;

            const numbers = input.value
                .replace(/\D/g, "")
                .slice(0, 11);

            if (numbers.length <= 3) {
                input.value = numbers;
                return;
            }

            if (numbers.length <= 7) {
                input.value =
                    `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
                return;
            }

            input.value =
                `${numbers.slice(0, 3)}-` +
                `${numbers.slice(3, 7)}-` +
                `${numbers.slice(7)}`;
        });

        function openTicketPurchaseModal() {
            if (!ticketPurchaseModal || !ticketPurchaseForm) return;

            ticketPurchaseForm.reset();
            hideTicketPurchaseError();
            ticketPurchaseSubmit.disabled = false;
            ticketPurchaseSubmit.textContent = "티켓 구매하기";

            lockPageScroll();

            ticketPurchaseModal.classList.add("is-open");
            ticketPurchaseModal.setAttribute("aria-hidden", "false");

            requestAnimationFrame(() => {
                ticketPurchaseForm.querySelector('input[name="name"]')?.focus();
            });
        }

        function closeTicketPurchaseModal() {
            if (
                !ticketPurchaseModal ||
                !ticketPurchaseModal.classList.contains("is-open")
            ) {
                return;
            }

            ticketPurchaseModal.classList.remove("is-open");
            ticketPurchaseModal.setAttribute("aria-hidden", "true");

            unlockPageScroll();
        }

        document.querySelectorAll(".js-open-ticket-modal").forEach((button) => {
            button.addEventListener("click", openTicketPurchaseModal);
        });

        ticketPurchaseModal?.addEventListener("click", (event) => {
            if (event.target.closest("[data-ticket-modal-close]")) {
                closeTicketPurchaseModal();
            }
        });

        ticketPurchaseForm?.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (ticketPurchaseSubmit?.disabled) {
                return;
            }

            // required, 전화번호 형식 등 브라우저 기본 유효성 검사 실행
            if (!ticketPurchaseForm.reportValidity()) {
                return;
            }

            const formData = new FormData(ticketPurchaseForm);

            const name = String(formData.get("name") || "").trim();
            const phone = String(formData.get("phone") || "").trim();
            const country = String(formData.get("country") || "").trim();
            const activityType = String(
                formData.get("activity_type") || "",
            ).trim();
            const registrationPath = String(
                formData.get("registration_path") || "",
            ).trim();
            const privacyAgreed =
                formData.get("privacy_agreed") === "on";

            if (!name) {
                showTicketPurchaseError("성명을 입력해 주세요.");
                return;
            }

            if (!phone) {
                showTicketPurchaseError("연락처를 입력해 주세요.", "phone");
                return;
            }

            const phoneNumbers = phone.replace(/\D/g, "");

            if (!/^010\d{8}$/.test(phoneNumbers)) {
                showTicketPurchaseError(
                    "올바른 휴대전화 번호를 입력해주세요.",
                    "phone",
                );
                return;
            }

            if (!privacyAgreed) {
                showTicketPurchaseError(
                    "개인정보 수집 및 이용 정책에 동의해 주세요.",
                );
                return;
            }

            /*
             * 사용자 클릭 이벤트 안에서 먼저 빈 창을 연다.
             * fetch 완료 후 window.open()을 호출하면 브라우저가
             * 팝업으로 판단해 차단할 수 있다.
             */
            const paymentWindow = window.open("", "_blank");

            if (paymentWindow) {
                paymentWindow.document.documentElement.style.backgroundColor = "#030506";
                paymentWindow.document.body.style.margin = "0";
                paymentWindow.document.body.style.backgroundColor = "#030506";

                paymentWindow.location.replace("/payment-loading.html");
            }

            if (!paymentWindow) {
                showTicketPurchaseError(
                    "결제창이 차단되었습니다. 브라우저의 팝업 차단을 해제해 주세요.",
                );
                return;
            }
            /*
             * 실제 정적 로딩 페이지를 먼저 열기 때문에
             * 모바일에서도 올바른 viewport로 표시된다.
             */
            paymentWindow.opener = null;


            hideTicketPurchaseError();

            if (ticketPurchaseSubmit) {
                ticketPurchaseSubmit.disabled = true;
                ticketPurchaseSubmit.textContent = "결제 준비 중...";
            }

            try {
                const response = await fetch(
                    TICKET_PREPARE_API_URL,
                    {
                        method: "POST",
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            conference_id: CONFERENCE_ID,
                            ticket_id: TICKET_ID,
                            name,
                            phone,
                            country: country || null,
                            activity_type: activityType || null,
                            registration_path: registrationPath || null,
                            privacy_agreed: privacyAgreed,
                        }),
                    },
                );

                const result = await response.json().catch(() => null);

                if (!response.ok) {
                    let message = "결제 정보를 준비하지 못했습니다.";
                    let fieldName = null;

                    if (Array.isArray(result?.detail)) {
                        const firstError = result.detail[0];

                        message = result.detail
                            .map((item) =>
                                String(item?.msg || "")
                                    .replace(/^Value error,\s*/i, "")
                                    .trim(),
                            )
                            .filter(Boolean)
                            .join("\n") || message;

                        fieldName =
                            firstError?.loc?.[firstError.loc.length - 1] || null;
                    } else if (typeof result?.detail === "string") {
                        message = result.detail;
                    }

                    const requestError = new Error(message);
                    requestError.fieldName = fieldName;
                    throw requestError;
                }

                const ticketRegistrationId = Number(
                    result?.ticket_registration_id ??
                    result?.ticket_user_id,
                )

                if (
                    !result?.redirect_url ||
                    !result?.payment_id ||
                    !Number.isInteger(ticketRegistrationId) ||
                    ticketRegistrationId <= 0
                ) {
                    throw new Error(
                        "결제 준비 정보를 받지 못했습니다.",
                    );
                }

                localStorage.setItem(
                    PAYMENT_STATUS_STORAGE_KEY,
                    JSON.stringify({
                        paymentId: result.payment_id,
                        ticketRegistrationId,
                        createdAt: Date.now(),
                    }),
                );

                closeTicketPurchaseModal();
                ticketPurchaseForm.reset();

                /*
                 * 원래 DAKS 페이지에서 결제 WebSocket을 연결하고,
                 * 새 창만 토스 링크페이 주소로 이동시킨다.
                 */
                startStoredPaymentSocket();

                paymentWindow.location.replace(
                    result.redirect_url,
                );
            } catch (error) {
                paymentWindow.close();

                showTicketPurchaseError(
                    error instanceof Error
                        ? error.message
                        : "결제 준비 중 오류가 발생했습니다.",
                    error?.fieldName || null,
                );
            } finally {
                if (ticketPurchaseSubmit) {
                    ticketPurchaseSubmit.disabled = false;
                    ticketPurchaseSubmit.textContent = "티켓 구매하기";
                }
            }
        });


        window.addEventListener("pageshow", () => {
            closeTicketPurchaseModal();
            ticketPurchaseForm?.reset();

            if (ticketPurchaseError) {
                ticketPurchaseError.hidden = true;
                ticketPurchaseError.textContent = "";
            }

            if (ticketPurchaseSubmit) {
                ticketPurchaseSubmit.disabled = false;
                ticketPurchaseSubmit.textContent = "티켓 구매하기";
            }

            startStoredPaymentSocket();
        });


        // =====================================
        // 최신 결제 시도 WebSocket 추적
        // =====================================

        const paymentResultModal =
            document.getElementById("payment-result-modal");
        const paymentResultSuccessView =
            document.getElementById("payment-result-success-view");
        const paymentResultName =
            document.getElementById("payment-result-name");
        const paymentResultDisplayOrderId =
            document.getElementById("payment-result-display-order-id");
        const paymentResultPaymentName =
            document.getElementById("payment-result-payment-name");
        const paymentResultAmount =
            document.getElementById("payment-result-amount");
        const paymentResultQuantity =
            document.getElementById("payment-result-quantity");
        const paymentResultPaidAt =
            document.getElementById("payment-result-paid-at");

        let paymentSocket = null;
        let paymentSocketReconnectTimer = null;
        let paymentSocketTimeoutTimer = null;
        let paymentStatusRequestInProgress = false;
        let paymentSocketManuallyClosed = false;
        let paymentSocketReconnectAttempts = 0;

        function getPaymentStatusApiUrl(paymentId, ticketRegistrationId) {
            return (
                `${API_BASE}/ticket-payments/` +
                `${encodeURIComponent(paymentId)}/status` +
                `?ticket_registration_id=${encodeURIComponent(ticketRegistrationId)}`
            );
        }

        function getPaymentWebSocketUrl(paymentId) {
            return (
                `${WS_ORIGIN}/ws/payment/` +
                `${encodeURIComponent(paymentId)}`
            );
        }

        function readStoredPayment() {
            const storedValue = localStorage.getItem(
                PAYMENT_STATUS_STORAGE_KEY,
            );

            if (!storedValue) return null;

            try {
                const parsed = JSON.parse(storedValue);
                const paymentId = Number(parsed?.paymentId);

                const ticketRegistrationId = Number(
                    parsed?.ticketRegistrationId ??
                    parsed?.ticketUserId,
                );

                if (
                    !Number.isInteger(paymentId) ||
                    paymentId <= 0 ||
                    !Number.isInteger(ticketRegistrationId) ||
                    ticketRegistrationId <= 0
                ) {
                    throw new Error("Invalid stored payment data");
                }

                return {
                    paymentId,
                    ticketRegistrationId,
                    createdAt: Number(parsed?.createdAt) || null,
                };
            } catch (error) {
                console.warn("Invalid stored payment data:", error);

                localStorage.removeItem(
                    PAYMENT_STATUS_STORAGE_KEY,
                );

                return null;
            }
        }

        function stopPaymentSocket() {
            paymentSocketManuallyClosed = true;

            if (paymentSocketReconnectTimer !== null) {
                window.clearTimeout(paymentSocketReconnectTimer);
                paymentSocketReconnectTimer = null;
            }

            if (paymentSocketTimeoutTimer !== null) {
                window.clearTimeout(paymentSocketTimeoutTimer);
                paymentSocketTimeoutTimer = null;
            }

            if (paymentSocket) {
                paymentSocket.onopen = null;
                paymentSocket.onmessage = null;
                paymentSocket.onerror = null;
                paymentSocket.onclose = null;

                if (
                    paymentSocket.readyState === WebSocket.OPEN ||
                    paymentSocket.readyState === WebSocket.CONNECTING
                ) {
                    paymentSocket.close();
                }

                paymentSocket = null;
            }
        }

        function formatPaymentAmount(value) {
            const amount = Number(value);

            if (!Number.isFinite(amount)) return "-";

            return `${amount.toLocaleString("ko-KR")}원`;
        }

        function formatPaymentResultDate(value) {
            if (!value) return "-";

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) return "-";

            return new Intl.DateTimeFormat("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
            }).format(date);
        }

        function openPaymentResultModal() {
            if (!paymentResultModal || !paymentResultSuccessView) return;

            paymentResultSuccessView.hidden = false;
            lockPageScroll();

            paymentResultModal.classList.add("is-open");
            paymentResultModal.setAttribute("aria-hidden", "false");
        }

        function closePaymentResultModal() {
            if (
                !paymentResultModal ||
                !paymentResultModal.classList.contains("is-open")
            ) {
                return;
            }

            paymentResultModal.classList.remove("is-open");
            paymentResultModal.setAttribute("aria-hidden", "true");
            unlockPageScroll();
        }

        function renderPaymentSuccess(payment) {
            if (paymentResultName) {
                paymentResultName.textContent = payment.name || "-";
            }

            if (paymentResultDisplayOrderId) {
                paymentResultDisplayOrderId.textContent =
                    payment.display_order_id || "-";
            }

            if (paymentResultPaymentName) {
                paymentResultPaymentName.textContent =
                    payment.payment_name || "-";
            }

            if (paymentResultAmount) {
                paymentResultAmount.textContent =
                    formatPaymentAmount(payment.amount);
            }

            if (paymentResultQuantity) {
                const amount = Number(payment.amount || 0);
                const quantity =
                    Number.isFinite(amount) && amount > 0
                        ? Math.max(
                            1,
                            Math.round(amount / TICKET_UNIT_PRICE),
                        )
                        : 1;

                paymentResultQuantity.textContent =
                    `${quantity}장`;
            }

            if (paymentResultPaidAt) {
                paymentResultPaidAt.textContent =
                    formatPaymentResultDate(payment.paid_at);
            }

            openPaymentResultModal();
        }

        async function requestStoredPaymentStatus() {
            if (paymentStatusRequestInProgress) return;

            const storedPayment = readStoredPayment();

            if (!storedPayment) {
                stopPaymentSocket();
                return;
            }

            paymentStatusRequestInProgress = true;

            try {
                const response = await fetch(
                    getPaymentStatusApiUrl(
                        storedPayment.paymentId,
                        storedPayment.ticketRegistrationId,
                    ),
                    {
                        method: "GET",
                        headers: {
                            Accept: "application/json",
                        },
                        cache: "no-store",
                    },
                );

                if (response.status === 404) {
                    localStorage.removeItem(
                        PAYMENT_STATUS_STORAGE_KEY,
                    );
                    stopPaymentSocket();
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        `결제 상태 조회 실패: ${response.status}`,
                    );
                }

                const payment = await response.json();

                console.log("결제 상태 조회 결과:", payment);

                if (
                    payment.status_code === "PAID" ||
                    (
                        payment.is_completed === true &&
                        payment.is_success === true
                    )
                ) {
                    localStorage.removeItem(
                        PAYMENT_STATUS_STORAGE_KEY,
                    );
                    stopPaymentSocket();
                    renderPaymentSuccess(payment);
                }
            } catch (error) {
                console.error(
                    "Payment status check failed:",
                    error,
                );
            } finally {
                paymentStatusRequestInProgress = false;
            }
        }

        function startStoredPaymentSocket() {
            const storedPayment = readStoredPayment();

            if (!storedPayment) return;

            stopPaymentSocket();
            paymentSocketManuallyClosed = false;
            paymentSocketReconnectAttempts = 0;

            const connect = () => {
                if (paymentSocketManuallyClosed) return;

                const latestStoredPayment = readStoredPayment();

                if (!latestStoredPayment) {
                    stopPaymentSocket();
                    return;
                }

                const socketUrl = getPaymentWebSocketUrl(
                    latestStoredPayment.paymentId,
                );

                console.log(
                    "결제 WebSocket 연결 시도:",
                    socketUrl,
                );

                paymentSocket = new WebSocket(socketUrl);

                paymentSocket.onopen = () => {
                    paymentSocketReconnectAttempts = 0;

                    console.log(
                        "결제 WebSocket 연결됨:",
                        latestStoredPayment.paymentId,
                    );

                    // WebSocket 연결 전에 웹훅 처리가 끝났을 수 있으므로
                    // 현재 결제 상태를 연결 직후 한 번 확인한다.
                    requestStoredPaymentStatus();
                };

                paymentSocket.onmessage = async (event) => {
                    console.log(
                        "결제 WebSocket 원본 데이터:",
                        event.data,
                    );

                    let message;

                    try {
                        message = JSON.parse(event.data);
                    } catch (error) {
                        console.error(
                            "WebSocket JSON 파싱 실패:",
                            error,
                        );
                        return;
                    }

                    console.log(
                        "결제 WebSocket 수신:",
                        message,
                    );

                    if (
                        message.type !==
                        "PAYMENT_STATUS_CHANGED"
                    ) {
                        return;
                    }

                    if (
                        Number(message.paymentId) !==
                        latestStoredPayment.paymentId
                    ) {
                        console.warn(
                            "다른 paymentId의 메시지를 수신했습니다.",
                            message,
                        );
                        return;
                    }

                    if (
                        message.status === "PAID" ||
                        Number(message.status) === 2
                    ) {
                        // WebSocket 메시지에는 성공 모달에 필요한 상세값이
                        // 모두 없으므로 기존 상태 조회 API를 한 번 호출한다.
                        await requestStoredPaymentStatus();
                    }
                };

                paymentSocket.onerror = (event) => {
                    console.error(
                        "결제 WebSocket 오류:",
                        event,
                    );
                };

                paymentSocket.onclose = (event) => {
                    console.log(
                        "결제 WebSocket 종료:",
                        event.code,
                        event.reason,
                    );

                    paymentSocket = null;

                    if (
                        paymentSocketManuallyClosed ||
                        !readStoredPayment()
                    ) {
                        return;
                    }

                    if (
                        paymentSocketReconnectAttempts >=
                        PAYMENT_SOCKET_MAX_RECONNECT_ATTEMPTS
                    ) {
                        console.warn(
                            "결제 WebSocket 최대 재연결 횟수에 도달했습니다.",
                        );
                        return;
                    }

                    paymentSocketReconnectAttempts += 1;
                    paymentSocketReconnectTimer = window.setTimeout(
                        connect,
                        PAYMENT_SOCKET_RECONNECT_DELAY_MS,
                    );
                };
            };

            connect();

            paymentSocketTimeoutTimer = window.setTimeout(
                async () => {
                    await requestStoredPaymentStatus();

                    // 제한 시간 안에 성공을 확인하지 못한 경우에는
                    // 실패/취소/대기 모달을 띄우지 않고 추적만 종료한다.
                    if (readStoredPayment()) {
                        stopPaymentSocket();
                    }
                },
                PAYMENT_SOCKET_MAX_WAIT_MS,
            );
        }

        paymentResultModal?.addEventListener("click", (event) => {
            if (event.target.closest("[data-payment-result-close]")) {
                closePaymentResultModal();
            }
        });


        // =====================================
        // 구매 내역 조회 모달
        // =====================================

        const paymentHistoryModal =
            document.getElementById("payment-history-modal");
        const paymentHistorySearchView =
            document.getElementById("payment-history-search-view");
        const paymentHistoryResultView =
            document.getElementById("payment-history-result-view");
        const paymentHistoryEmptyView =
            document.getElementById("payment-history-empty-view");
        const paymentHistoryForm =
            document.getElementById("payment-history-form");
        const paymentHistoryError =
            document.getElementById("payment-history-error");
        const paymentHistorySubmit =
            document.getElementById("payment-history-submit");
        const paymentHistoryList =
            document.getElementById("payment-history-list");
        const paymentHistoryPagination =
            document.getElementById("payment-history-pagination");
        const paymentHistoryCustomerName =
            document.getElementById("payment-history-customer-name");
        const paymentHistoryPhoneInput =
            paymentHistoryForm?.querySelector('input[name="phone"]');

        const TICKET_UNIT_PRICE = 19900;
        const PAYMENT_PAGE_WINDOW_SIZE = 5;

        let paymentHistoryData = null;
        let paidPaymentHistoryItems = [];
        let currentPaymentHistoryIndex = 0;

        function showPaymentHistoryView(view) {
            if (paymentHistorySearchView) {
                paymentHistorySearchView.hidden = view !== "search";
            }

            if (paymentHistoryResultView) {
                paymentHistoryResultView.hidden = view !== "result";
            }

            if (paymentHistoryEmptyView) {
                paymentHistoryEmptyView.hidden = view !== "empty";
            }
        }

        function resetPaymentHistoryModal() {
            paymentHistoryForm?.reset();

            paymentHistoryData = null;
            paidPaymentHistoryItems = [];
            currentPaymentHistoryIndex = 0;

            if (paymentHistoryError) {
                paymentHistoryError.hidden = true;
                paymentHistoryError.textContent = "";
            }

            if (paymentHistorySubmit) {
                paymentHistorySubmit.disabled = false;
                paymentHistorySubmit.textContent = "내역 조회하기";
            }

            if (paymentHistoryList) {
                paymentHistoryList.innerHTML = "";
            }

            if (paymentHistoryPagination) {
                paymentHistoryPagination.hidden = true;
                paymentHistoryPagination.innerHTML = "";
            }

            showPaymentHistoryView("search");
        }

        function openPaymentHistoryModal() {
            if (!paymentHistoryModal) return;

            resetPaymentHistoryModal();
            lockPageScroll();

            paymentHistoryModal.classList.add("is-open");
            paymentHistoryModal.setAttribute("aria-hidden", "false");

            requestAnimationFrame(() => {
                paymentHistoryForm
                    ?.querySelector('input[name="name"]')
                    ?.focus();
            });
        }

        function closePaymentHistoryModal() {
            if (
                !paymentHistoryModal ||
                !paymentHistoryModal.classList.contains("is-open")
            ) {
                return;
            }

            paymentHistoryModal.classList.remove("is-open");
            paymentHistoryModal.setAttribute("aria-hidden", "true");

            unlockPageScroll();
        }

        function formatPaymentDate(value) {
            if (!value) {
                return "확인 중";
            }

            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                return "확인 중";
            }

            return new Intl.DateTimeFormat("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            }).format(date);
        }

        function renderPaymentHistoryPagination() {
            if (!paymentHistoryPagination) return;

            const totalItems = paidPaymentHistoryItems.length;

            if (totalItems <= 1) {
                paymentHistoryPagination.hidden = true;
                paymentHistoryPagination.innerHTML = "";
                return;
            }

            const windowStart =
                Math.floor(
                    currentPaymentHistoryIndex /
                    PAYMENT_PAGE_WINDOW_SIZE,
                ) * PAYMENT_PAGE_WINDOW_SIZE;

            const windowEnd = Math.min(
                windowStart + PAYMENT_PAGE_WINDOW_SIZE,
                totalItems,
            );

            const buttons = [];

            if (windowStart > 0) {
                buttons.push(`
                    <button
                        type="button"
                        class="payment-history-page-nav"
                        data-payment-history-page="${windowStart - 1}"
                        aria-label="이전 구매 내역 페이지 묶음"
                    >
                        ‹
                    </button>
                `);
            }

            for (
                let index = windowStart;
                index < windowEnd;
                index += 1
            ) {
                const isActive =
                    index === currentPaymentHistoryIndex;

                buttons.push(`
                    <button
                        type="button"
                        class="payment-history-page-button
                            ${isActive ? "is-active" : ""}"
                        data-payment-history-page="${index}"
                        aria-label="${index + 1}번째 구매 내역"
                        aria-current="${isActive ? "page" : "false"}"
                    >
                        ${index + 1}
                    </button>
                `);
            }

            if (windowEnd < totalItems) {
                buttons.push(`
                    <button
                        type="button"
                        class="payment-history-page-nav"
                        data-payment-history-page="${windowEnd}"
                        aria-label="다음 구매 내역 페이지 묶음"
                    >
                        ›
                    </button>
                `);
            }

            paymentHistoryPagination.hidden = false;
            paymentHistoryPagination.innerHTML =
                buttons.join("");
        }

        function renderPaymentHistoryPage(index) {
            if (
                !paymentHistoryData ||
                !paymentHistoryList ||
                !paymentHistoryCustomerName ||
                paidPaymentHistoryItems.length === 0 ||
                index < 0 ||
                index >= paidPaymentHistoryItems.length
            ) {
                return;
            }

            currentPaymentHistoryIndex = index;

            const payment =
                paidPaymentHistoryItems[currentPaymentHistoryIndex];

            const amount = Number(payment.amount || 0);

            const quantity =
                amount > 0
                    ? Math.max(
                        1,
                        Math.round(amount / TICKET_UNIT_PRICE),
                    )
                    : 1;

            const displayOrderId =
                payment.display_order_id || "주문번호 확인 중";

            const numericStatus = Number(payment.status);

            const statusName =
                payment.status_name ||
                (
                    numericStatus === 2
                        ? "결제 완료"
                        : numericStatus === 3
                            ? "결제 실패"
                            : numericStatus === 4
                                ? "결제 취소"
                                : "상태 확인 필요"
                );

            const statusClass =
                numericStatus === 4
                    ? "is-canceled"
                    : numericStatus === 3
                        ? "is-failed"
                        : numericStatus === 2
                            ? "is-paid"
                            : "";

            paymentHistoryCustomerName.textContent =
                paymentHistoryData.name || "";

            paymentHistoryList.innerHTML = `
                <article class="payment-history-item">
                    <dl>
                        <div>
                            <dt>성명</dt>
                            <dd>
                                ${escapeHtml(paymentHistoryData.name)}
                            </dd>
                        </div>

                        <div>
                            <dt>주문 번호</dt>
                            <dd>${escapeHtml(displayOrderId)}</dd>
                        </div>

                        <div>
                            <dt>결제 상태</dt>
                            <dd class="payment-history-status ${statusClass}">
                                ${escapeHtml(statusName)}
                            </dd>
                        </div>

                        <div>
                            <dt>결제 금액</dt>
                            <dd>
                                ${amount.toLocaleString("ko-KR")}원
                            </dd>
                        </div>

                        <div>
                            <dt>구매 수량</dt>
                            <dd>${quantity}장</dd>
                        </div>

                        <div>
                            <dt>결제 일시</dt>
                            <dd>
                                ${formatPaymentDate(payment.paid_at)}
                            </dd>
                        </div>
                    </dl>
                </article>
            `;

            renderPaymentHistoryPagination();
            showPaymentHistoryView("result");
        }

        document
            .querySelectorAll(".js-open-payment-history-modal")
            .forEach((button) => {
                button.addEventListener(
                    "click",
                    openPaymentHistoryModal,
                );
            });

        paymentHistoryModal?.addEventListener("click", (event) => {
            const pageButton = event.target.closest(
                "[data-payment-history-page]",
            );

            if (pageButton) {
                const pageIndex = Number(
                    pageButton.dataset.paymentHistoryPage,
                );

                if (
                    Number.isInteger(pageIndex) &&
                    pageIndex >= 0 &&
                    pageIndex < paidPaymentHistoryItems.length
                ) {
                    renderPaymentHistoryPage(pageIndex);
                }

                return;
            }

            if (
                event.target.closest(
                    "[data-payment-history-close]",
                )
            ) {
                closePaymentHistoryModal();
                return;
            }

            if (
                event.target.closest(
                    "[data-payment-history-retry]",
                )
            ) {
                resetPaymentHistoryModal();

                requestAnimationFrame(() => {
                    paymentHistoryForm
                        ?.querySelector('input[name="name"]')
                        ?.focus();
                });
            }
        });

        paymentHistoryPhoneInput?.addEventListener(
            "input",
            (event) => {
                const input = event.currentTarget;

                const numbers = input.value
                    .replace(/\D/g, "")
                    .slice(0, 11);

                if (numbers.length <= 3) {
                    input.value = numbers;
                    return;
                }

                if (numbers.length <= 7) {
                    input.value =
                        `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
                    return;
                }

                input.value =
                    `${numbers.slice(0, 3)}-` +
                    `${numbers.slice(3, 7)}-` +
                    `${numbers.slice(7)}`;
            },
        );

        paymentHistoryForm?.addEventListener(
            "submit",
            async (event) => {
                event.preventDefault();

                if (!paymentHistoryForm.reportValidity()) {
                    return;
                }

                const formData =
                    new FormData(paymentHistoryForm);

                const payload = {
                    conference_id: CONFERENCE_ID,

                    name: String(
                        formData.get("name") || "",
                    ).trim(),
                    phone: String(
                        formData.get("phone") || "",
                    ),
                };

                if (paymentHistoryError) {
                    paymentHistoryError.hidden = true;
                    paymentHistoryError.textContent = "";
                }

                if (paymentHistorySubmit) {
                    paymentHistorySubmit.disabled = true;
                    paymentHistorySubmit.textContent = "조회 중...";
                }

                try {
                    const response = await fetch(
                        PAYMENT_HISTORY_API_URL,
                        {
                            method: "POST",
                            headers: {
                                Accept: "application/json",
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify(payload),
                        },
                    );

                    const result = await response
                        .json()
                        .catch(() => null);

                    if (!response.ok) {
                        showPaymentHistoryView("empty");
                        return;
                    }

                    // 백엔드에서 READY(1)를 제외한 결제 완료/실패/취소 내역을
                    // 이미 내려주므로 프론트에서 status === 2로 다시 제한하지 않는다.
                    const visiblePayments =
                        Array.isArray(result?.payments)
                            ? result.payments
                            : [];

                    if (visiblePayments.length === 0) {
                        showPaymentHistoryView("empty");
                        return;
                    }

                    paymentHistoryData = result;
                    paidPaymentHistoryItems = visiblePayments;
                    currentPaymentHistoryIndex = 0;

                    renderPaymentHistoryPage(0);
                } catch (error) {
                    if (paymentHistoryError) {
                        paymentHistoryError.textContent =
                            "구매 내역 조회 중 오류가 발생했습니다.";
                        paymentHistoryError.hidden = false;
                    }

                    showPaymentHistoryView("search");
                } finally {
                    if (paymentHistorySubmit) {
                        paymentHistorySubmit.disabled = false;
                        paymentHistorySubmit.textContent =
                            "내역 조회하기";
                    }
                }
            },
        );

        document.addEventListener("keydown", (event) => {
            if (
                event.key === "Escape" &&
                paymentHistoryModal?.classList.contains("is-open")
            ) {
                closePaymentHistoryModal();
            }
        });

        // const APPLICATION_API_BASE =
        //     location.hostname === "localhost" || location.hostname === "127.0.0.1"
        //         ? "http://127.0.0.1:8000/api/public"
        //         : "https://api.digitalassetkoreasummit.com/api/public";

        // const APPLICATION_API_BASE = "https://api.digitalassetkoreasummit.com/api/public";

        const actionModal = document.getElementById("action-modal");
        const actionModalTitle = document.getElementById("action-modal-title");
        const actionModalDescription =
            document.getElementById("action-modal-description");
        const actionModalIntro = document.getElementById("application-modal-intro");
        const applicationForm = document.getElementById("application-form");
        const applicationFormFields =
            document.getElementById("application-form-fields");
        const applicationFormError =
            document.getElementById("application-form-error");
        const applicationSubmit = document.getElementById("application-submit");
        const applicationSuccess =
            document.getElementById("application-success");
        const applicationSuccessTitle =
            document.getElementById("application-success-title");

        let currentApplicationType = null;

        const applicationConfig = {
            booth: {
                title: "부스 참가 신청",
                description:
                    "디지털 자산 생태계 선도 기업들을 위한 전략적 파트너십 기회를 제공합니다. 디지털 자산의 미래를 함께 그려주세요.",
                submitText: "부스 참가 신청하기",
                successTitle: "부스 참가 신청이 완료되었습니다.",
                endpoint: `${APPLICATION_API_BASE}/booth-applications`,
                fields: [
                    {
                        name: "company_name",
                        label: "회사/프로젝트 명",
                        placeholder: "블록체인투데이/2026DKS",
                        required: true,
                    },
                    {
                        name: "email",
                        label: "Email",
                        placeholder: "example@gmail.com",
                        type: "email",
                        required: true,
                    },
                    {
                        name: "phone",
                        label: "연락처",
                        placeholder: "010-1234-5678",
                        required: true,
                    },
                    {
                        name: "contact_name",
                        label: "담당자 성함",
                        placeholder: "홍길동",
                        required: true,
                    },
                    {
                        name: "operation_plan",
                        label: "부스 운영 계획 및 전달 사항",
                        placeholder: "내용을 입력해주세요.",
                        textarea: true,
                        required: true,
                    },
                ],
            },
            speaker: {
                title: "연사 참가 신청",
                description:
                    "디지털 자산 생태계 선도 기업들을 위한 전략적 파트너십 기회를 제공합니다. 디지털 자산의 미래를 함께 그려주세요.",
                submitText: "연사 참가 신청하기",
                successTitle: "연사 참가 신청이 완료되었습니다.",
                endpoint: `${APPLICATION_API_BASE}/speaker-applications`,
                fields: [
                    {
                        name: "name",
                        label: "성함",
                        placeholder: "홍길동",
                        required: true,
                    },
                    {
                        name: "company_name",
                        label: "회사/프로젝트 명",
                        placeholder: "블록체인투데이/2026DKS",
                        required: true,
                    },
                    {
                        name: "email",
                        label: "Email",
                        placeholder: "example@gmail.com",
                        type: "email",
                        required: true,
                    },
                    {
                        name: "phone",
                        label: "연락처",
                        placeholder: "010-1234-5678",
                        required: true,
                    },
                    {
                        name: "social_url",
                        label: "소셜 미디어 링크",
                        placeholder: "URL 주소를 입력해주세요.",
                        type: "url",
                        required: false,
                    },
                    {
                        name: "presentation_content",
                        label: "강연 주제 및 내용",
                        placeholder: "내용을 입력해주세요.",
                        textarea: true,
                        required: true,
                    },
                ],
            },
        };

        function createApplicationField(field) {
            const requiredMark = field.required
                ? '<span class="application-required">*</span>'
                : "";

            const control = field.textarea
                ? `
            <textarea
              name="${field.name}"
              placeholder="${field.placeholder}"
              ${field.required ? "required" : ""}
            ></textarea>
          `
                : `
            <input
              type="${field.type || "text"}"
              name="${field.name}"
              placeholder="${field.placeholder}"
              ${field.required ? "required" : ""}
            />
          `;

            return `
          <label class="application-field">
            <span class="application-field-label">
              ${field.label}${requiredMark}
            </span>
            ${control}
          </label>
        `;
        }

        function resetApplicationModal() {
            applicationForm.reset();
            applicationFormError.hidden = true;
            applicationFormError.textContent = "";
            applicationSuccess.hidden = true;
            applicationForm.hidden = false;
            actionModalIntro.hidden = false;
            applicationSubmit.disabled = false;
        }

        function openApplicationModal(type) {
            const config = applicationConfig[type];
            if (!config) return;

            currentApplicationType = type;
            resetApplicationModal();

            actionModalTitle.textContent = config.title;
            actionModalDescription.textContent = config.description;
            applicationSubmit.textContent = config.submitText;
            applicationSubmit.classList.toggle("is-speaker", type === "speaker");
            applicationFormFields.innerHTML =
                config.fields.map(createApplicationField).join("");

            lockPageScroll();

            actionModal.classList.add("is-open");
            actionModal.setAttribute("aria-hidden", "false");

            requestAnimationFrame(() => {
                applicationForm.querySelector("input, textarea")?.focus();
            });
        }

        function openGenericActionModal(title) {
            currentApplicationType = null;
            resetApplicationModal();

            actionModalTitle.textContent = title;
            actionModalDescription.textContent = "해당 기능은 준비 중입니다.";
            applicationForm.hidden = true;

            lockPageScroll();

            actionModal.classList.add("is-open");
            actionModal.setAttribute("aria-hidden", "false");
        }

        function closeActionModal() {
            if (!actionModal.classList.contains("is-open")) {
                return;
            }

            actionModal.classList.remove("is-open");
            actionModal.setAttribute("aria-hidden", "true");
            currentApplicationType = null;

            unlockPageScroll();
        }

        document.querySelectorAll(".js-open-action-modal").forEach((button) => {
            button.addEventListener("click", () => {
                const type = button.dataset.modalType;

                if (type === "booth" || type === "speaker") {
                    openApplicationModal(type);
                    return;
                }

                openGenericActionModal(button.dataset.modalTitle || "안내");
            });
        });

        actionModal.addEventListener("click", (event) => {
            if (event.target.closest("[data-action-modal-close]")) {
                closeActionModal();
            }
        });

        applicationForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const config = applicationConfig[currentApplicationType];
            if (!config) return;

            if (!applicationForm.reportValidity()) return;

            const formData = new FormData(applicationForm);
            const payload = Object.fromEntries(formData.entries());
            payload.privacy_agreed =
                formData.get("privacy_agreed") === "on";

            applicationFormError.hidden = true;
            applicationSubmit.disabled = true;
            applicationSubmit.textContent = "신청 중...";

            try {
                const response = await fetch(config.endpoint, {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const errorBody = await response.json().catch(() => null);

                    const message = Array.isArray(errorBody?.detail)
                        ? errorBody.detail
                            .map((item) => item.msg)
                            .filter(Boolean)
                            .join("\n")
                        : errorBody?.detail || "신청 처리 중 오류가 발생했습니다.";

                    throw new Error(message);
                }

                applicationForm.hidden = true;
                actionModalIntro.hidden = true;
                applicationSuccessTitle.textContent = config.successTitle;
                applicationSuccess.hidden = false;
            } catch (error) {
                applicationFormError.textContent =
                    error.message || "신청 처리 중 오류가 발생했습니다.";
                applicationFormError.hidden = false;
                applicationSubmit.disabled = false;
                applicationSubmit.textContent = config.submitText;
            }
        });


        await initializeSpeakers();
        startStoredPaymentSocket();

    });

document.addEventListener("DOMContentLoaded", () => {
        const countdown = document.querySelector(".countdown");
        const faqSection = document.getElementById("faq");

        if (!countdown || !faqSection) return;

        const updateCountdownVisibility = () => {
            const faqRect = faqSection.getBoundingClientRect();
            const viewportHeight =
                window.visualViewport?.height || window.innerHeight;

            const isFaqVisible =
                faqRect.top < viewportHeight &&
                faqRect.bottom > 0;

            countdown.classList.toggle(
                "is-hidden-at-faq",
                isFaqVisible,
            );
        };

        let ticking = false;

        const requestVisibilityUpdate = () => {
            if (ticking) return;

            ticking = true;
            window.requestAnimationFrame(() => {
                updateCountdownVisibility();
                ticking = false;
            });
        };

        updateCountdownVisibility();

        window.addEventListener(
            "scroll",
            requestVisibilityUpdate,
            { passive: true },
        );
        window.addEventListener("resize", requestVisibilityUpdate);
        window.visualViewport?.addEventListener(
            "resize",
            requestVisibilityUpdate,
        );


    });



/* ==========================================
   Mobile Header Navigation
========================================== */

document.addEventListener("DOMContentLoaded", () => {
    const menuButton = document.querySelector(".menu-toggle");
    const mobileMenu = document.querySelector("#mobile-menu");
    const desktopBreakpoint = window.matchMedia("(min-width: 1024px)");

    if (!menuButton || !mobileMenu) return;

    const main = document.querySelector("main");
    const footer = document.querySelector("footer");

    let previousFocus = null;

    function setMenu(open, restoreFocus = false) {
        if (open) {
            previousFocus = document.activeElement;
        }

        mobileMenu.hidden = !open;
        document.body.classList.toggle("menu-open", open);

        menuButton.setAttribute("aria-expanded", String(open));
        menuButton.setAttribute(
            "aria-label",
            open ? "메뉴 닫기" : "메뉴 열기"
        );

        if (main) main.inert = open;
        if (footer) footer.inert = open;

        if (open) {
            mobileMenu.querySelector("a")?.focus();
        } else if (restoreFocus) {
            if (previousFocus?.isConnected) {
                previousFocus.focus();
            } else {
                menuButton.focus();
            }
        }
    }

    // 햄버거 버튼 클릭
    menuButton.addEventListener("click", () => {
        const isOpening = mobileMenu.hidden;
        setMenu(isOpening, !isOpening);
    });

    // 모바일 메뉴 링크 클릭
    mobileMenu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            setMenu(false);

            const hash = link.hash;
            if (!hash) return;

            const target = document.getElementById(
                decodeURIComponent(hash.slice(1))
            );

            if (target) {
                target.setAttribute("tabindex", "-1");

                requestAnimationFrame(() => {
                    target.focus({ preventScroll: true });
                });
            }
        });
    });

    // ESC 및 Tab 키보드 처리
    document.addEventListener("keydown", (event) => {
        if (mobileMenu.hidden) return;

        if (event.key === "Escape") {
            setMenu(false, true);
            return;
        }

        if (event.key !== "Tab") return;

        const focusable = [
            menuButton,
            ...mobileMenu.querySelectorAll("a")
        ];

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (
            !event.shiftKey &&
            document.activeElement === last
        ) {
            event.preventDefault();
            first.focus();
        }
    });

    // PC 화면으로 전환 시 모바일 메뉴 닫기
    desktopBreakpoint.addEventListener("change", (event) => {
        if (event.matches) {
            setMenu(false);
        }
    });
});

/* ==========================================
   Navigation Section Scroll
========================================== */

(() => {
    function scrollToSection(targetId) {
        const target = document.getElementById(targetId);

        if (!target) return;

        const headerHeight =
            document.querySelector(".site-header")?.offsetHeight ?? 0;

        const targetY =
            target.getBoundingClientRect().top +
            window.scrollY -
            headerHeight;

        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });

        window.scrollTo({
            top: targetY,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                ? "instant"
                : "smooth"
        });
    }

    // DAKS 내부 메뉴 이동
    document.addEventListener("click", event => {
        const link = event.target.closest("a[data-scroll-target]");

        if (!link || event.defaultPrevented) return;

        if (event.ctrlKey || event.metaKey ||
            event.shiftKey || event.altKey) return;

        event.preventDefault();
        scrollToSection(link.dataset.scrollTarget);
    });

    // AI x SOFTWAVE에서 이동한 경우
    window.addEventListener("load", () => {
        const targetId = sessionStorage.getItem("pendingScrollTarget");

        if (!targetId) return;

        sessionStorage.removeItem("pendingScrollTarget");
        scrollToSection(targetId);
    });
})();


document.addEventListener("click", event => {
    const link = event.target.closest("a[data-scroll-top]");

    if (!link || event.defaultPrevented) return;

    if (event.ctrlKey || event.metaKey ||
        event.shiftKey || event.altKey) return;

    event.preventDefault();

    window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth"
    });
});
