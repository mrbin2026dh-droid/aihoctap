"""OAuth must never manufacture sessions when provider/SDK is unavailable."""
import pytest
from playwright.sync_api import expect


@pytest.mark.parametrize("button", ["#btnFacebookSignIn", "#btnGoogleSignIn"])
def test_facebook_sign_in_graceful_flow(ui_page, button):
    page = ui_page
    page.on("dialog", lambda dialog: dialog.accept())
    page.locator(button).click()
    expect(page.locator(button)).to_be_enabled()
    expect(page.locator("#studentLoginPortal")).to_be_visible()
    assert page.evaluate("!studentAuthState.isLoggedIn")
    assert page.evaluate("!JSON.parse(localStorage.getItem('ai_sgk_student_auth') || '{}').isLoggedIn")
    assert not page.page_errors


def test_facebook_success_preserves_provider_id_token(ui_page):
    page = ui_page
    page.evaluate("""() => {
      const auth = () => ({setPersistence:async()=>{},signInWithPopup:async()=>({user:{
        uid:'synthetic-facebook',displayName:'Synthetic Facebook',email:'synthetic@example.invalid',
        getIdToken:async()=> 'synthetic-provider-token'}})});
      auth.Auth = {Persistence:{LOCAL:'local'}};
      auth.FacebookAuthProvider = class {addScope(){} setCustomParameters(){}};
      window.firebase = {apps:[{}],auth};
    }""")
    page.locator("#btnFacebookSignIn").click()
    expect(page.locator("#studentLoginPortal")).to_be_hidden()
    assert page.evaluate("studentAuthState.token") == "synthetic-provider-token"
    expect(page.locator("#stdUserName")).to_contain_text("Synthetic Facebook")
