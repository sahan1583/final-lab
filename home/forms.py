from django import forms
from django.contrib.auth.models import User
from .models import Case, CaseUpdate
# from django.contrib.auth.forms import UserCreationForm

#for admin signup
class AdminSigupForm(forms.ModelForm):
    class Meta:
        model=User
        fields=['first_name','last_name','username','password']
        widgets = {
        'password': forms.PasswordInput()
        }

#for member signup
class MemberUserForm(forms.ModelForm):
    phone_number = forms.CharField(max_length=10, required=True)
    password = forms.CharField(widget=forms.PasswordInput())
    password2 = forms.CharField(label='Confirm Password', widget=forms.PasswordInput())

    class Meta:
        model=User
        fields=['first_name','last_name','username','password']
        # widgets = {
        # 'password': forms.PasswordInput()
        # }

    def clean_password2(self):
        password = self.cleaned_data.get('password')
        password2 = self.cleaned_data.get('password2')
        if password and password2 and password != password2:
            raise forms.ValidationError("Passwords don't match")
        return password2

class CaseForm(forms.ModelForm):
    class Meta:
        model=Case
        fields=['created_by','title','description','location','image', 'phone_number']

class CaseUpdateForm(forms.ModelForm):
    class Meta:
        model=CaseUpdate
        fields=['title','description','location','image']